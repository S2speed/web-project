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
    link = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'notification'
        verbose_name_plural = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.display_name} - {self.title}"

    def mark_as_read(self):
        self.is_read = True
        self.save()


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
        TicketReply.objects.create(ticket=self, user=user, message=reply_message)
        self.status = 'answered'
        self.save()


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
