from django.db import models
from django.conf import settings
from django.utils import timezone


class Notification(models.Model):
    """Notification for a user."""

    TYPE_CHOICES = (
        ('subscription', 'subscription'),
        ('new_release', 'new_release'),
        ('verification', 'verification'),
        ('financial', 'financial'),
        ('ticket', 'ticket'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    link = models.CharField(max_length=500, blank=True, null=True)
    dedupe_key = models.CharField(max_length=160, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'notification'
        verbose_name_plural = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at'], name='notification_user_state_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'dedupe_key'],
                condition=~models.Q(dedupe_key=''),
                name='unique_user_notification_dedupe_key',
            ),
        ]

    def __str__(self):
        return f"{self.user.display_name} - {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])


class Ticket(models.Model):
    """Support ticket model."""

    STATUS_CHOICES = (
        ('open', 'open'),
        ('answered', 'answered'),
        ('closed', 'closed'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tickets')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'ticket'
        verbose_name_plural = 'tickets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subject} - {self.user.display_name}"

    def reply(self, reply_message, user):
        """Append a reply and move the ticket to the sender-appropriate state."""
        is_from_support = user.is_superuser or user.role in ('admin', 'support')
        reply = TicketReply.objects.create(
            ticket=self,
            user=user,
            message=reply_message,
            is_from_support=is_from_support,
        )
        self.status = 'answered' if is_from_support else 'open'
        self.resolved_at = None
        if is_from_support and self.assigned_to_id is None:
            self.assigned_to = user
        self.save(update_fields=['status', 'resolved_at', 'assigned_to', 'updated_at'])
        return reply

    def close(self):
        """Close the ticket idempotently."""
        if self.status != 'closed':
            self.status = 'closed'
            self.resolved_at = timezone.now()
            self.save(update_fields=['status', 'resolved_at', 'updated_at'])


class TicketReply(models.Model):
    """Reply to a ticket."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='replies')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    is_from_support = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'ticket reply'
        verbose_name_plural = 'ticket replies'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.display_name} - {self.ticket.subject}"
