"""Support ticket API views."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, Ticket
from .serializers import (
    NotificationSerializer,
    TicketCreateSerializer,
    TicketReplyCreateSerializer,
    TicketSerializer,
)
from .services import create_notification, ensure_subscription_expiry_notification, notify_users


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_subscription_expiry_notification(request.user)
        queryset = Notification.objects.filter(user=request.user)

        read_state = request.query_params.get('state')
        if read_state:
            if read_state not in ('read', 'unread'):
                return Response({'state': ['Use read or unread.']}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(is_read=read_state == 'read')

        notification_type = request.query_params.get('type')
        if notification_type:
            if notification_type not in dict(Notification.TYPE_CHOICES):
                return Response({'type': ['Invalid notification type.']}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(type=notification_type)

        unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
        paginator = NotificationPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        response = paginator.get_paginated_response(NotificationSerializer(page, many=True).data)
        response.data['unread_count'] = unread_count
        return response


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        notification = get_object_or_404(Notification, id=notification_id, user=request.user)
        notification.mark_as_read()
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        updated = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )
        return Response({'updated_count': updated, 'unread_count': 0})


class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id):
        notification = get_object_or_404(Notification, id=notification_id, user=request.user)
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _can_manage_tickets(user):
    return user.is_superuser or user.role in ('admin', 'support')


def _visible_ticket(request, ticket_id):
    queryset = Ticket.objects.select_related('user', 'assigned_to').prefetch_related('replies__user')
    ticket = get_object_or_404(queryset, id=ticket_id)
    if not _can_manage_tickets(request.user) and ticket.user_id != request.user.id:
        return None
    return ticket


class TicketListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Ticket.objects.select_related('user', 'assigned_to').prefetch_related('replies__user')
        if not _can_manage_tickets(request.user):
            queryset = queryset.filter(user=request.user)

        ticket_status = request.query_params.get('status')
        if ticket_status:
            if ticket_status not in dict(Ticket.STATUS_CHOICES):
                return Response({'status': ['Invalid ticket status.']}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(status=ticket_status)

        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(subject__icontains=search)
                | Q(message__icontains=search)
                | Q(user__display_name__icontains=search)
                | Q(user__email__icontains=search)
            )

        data = TicketSerializer(queryset, many=True).data
        return Response({'count': len(data), 'results': data})

    def post(self, request):
        serializer = TicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save(user=request.user)

        staff_users = request.user.__class__.objects.filter(
            Q(role__in=('admin', 'support')) | Q(is_superuser=True),
        ).distinct()
        notify_users(
            staff_users,
            type='ticket',
            title='New support ticket',
            message=f'{request.user.display_name} opened ticket #{ticket.id}: {ticket.subject}',
            link=f'/admin/dashboard?ticket={ticket.id}',
            dedupe_key=f'new-ticket:{ticket.id}',
        )
        return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        ticket = _visible_ticket(request, ticket_id)
        if ticket is None:
            return Response({'detail': 'You do not have access to this ticket.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(TicketSerializer(ticket).data)


class TicketReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        serializer = TicketReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            ticket = get_object_or_404(Ticket.objects.select_for_update(), id=ticket_id)
            if not _can_manage_tickets(request.user) and ticket.user_id != request.user.id:
                return Response({'detail': 'You do not have access to this ticket.'}, status=status.HTTP_403_FORBIDDEN)
            if ticket.status == 'closed':
                return Response({'detail': 'Closed tickets cannot receive replies.'}, status=status.HTTP_409_CONFLICT)

            reply = ticket.reply(serializer.validated_data['message'], request.user)
            if reply.is_from_support:
                create_notification(
                    user=ticket.user,
                    type='ticket',
                    title=f'Reply to ticket #{ticket.id}',
                    message=reply.message,
                    link=f'/tickets/{ticket.id}',
                    dedupe_key=f'ticket-reply:{reply.id}',
                )

        ticket = Ticket.objects.select_related('user', 'assigned_to').prefetch_related('replies__user').get(id=ticket.id)
        return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        with transaction.atomic():
            ticket = get_object_or_404(Ticket.objects.select_for_update(), id=ticket_id)
            if not _can_manage_tickets(request.user) and ticket.user_id != request.user.id:
                return Response({'detail': 'You do not have access to this ticket.'}, status=status.HTTP_403_FORBIDDEN)
            ticket.close()

        return Response(TicketSerializer(ticket).data)
