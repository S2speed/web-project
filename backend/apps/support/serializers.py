from rest_framework import serializers

from .models import Notification, Ticket, TicketReply


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id', 'type', 'title', 'message', 'is_read', 'read_at',
            'link', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class TicketUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    role = serializers.CharField(read_only=True)


class TicketReplySerializer(serializers.ModelSerializer):
    user = TicketUserSerializer(read_only=True)

    class Meta:
        model = TicketReply
        fields = ('id', 'user', 'message', 'is_from_support', 'created_at')


class TicketSerializer(serializers.ModelSerializer):
    user = TicketUserSerializer(read_only=True)
    assigned_to = TicketUserSerializer(read_only=True)
    replies = TicketReplySerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = (
            'id', 'user', 'subject', 'message', 'status', 'assigned_to',
            'replies', 'created_at', 'updated_at', 'resolved_at',
        )


class TicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ('subject', 'message')

    def validate_subject(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Subject cannot be blank.')
        return value

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message cannot be blank.')
        return value


class TicketReplyCreateSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate_message(self, value):
        if not value:
            raise serializers.ValidationError('Message cannot be blank.')
        return value
