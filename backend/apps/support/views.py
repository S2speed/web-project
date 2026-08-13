"""Support ticket API views."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, Ticket
from .serializers import (
    TicketCreateSerializer,
    TicketReplyCreateSerializer,
    TicketSerializer,
)


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
        Notification.objects.bulk_create([
            Notification(
                user=staff_user,
                type='ticket',
                title='New support ticket',
                message=f'{request.user.display_name} opened ticket #{ticket.id}: {ticket.subject}',
                link=f'/admin/dashboard?ticket={ticket.id}',
            )
            for staff_user in staff_users
        ])
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
                Notification.objects.create(
                    user=ticket.user,
                    type='ticket',
                    title=f'Reply to ticket #{ticket.id}',
                    message=reply.message,
                    link=f'/tickets/{ticket.id}',
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
