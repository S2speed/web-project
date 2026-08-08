from django.contrib import admin
from .models import Notification, Ticket, TicketReply


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
	list_display = ('user', 'type', 'title', 'is_read', 'created_at')
	list_filter = ('type', 'is_read', 'created_at')
	search_fields = ('user__display_name', 'user__email', 'title')
	ordering = ('-created_at',)
	readonly_fields = ('created_at', 'updated_at')


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
	list_display = ('subject', 'user', 'status', 'created_at')
	list_filter = ('status', 'created_at')
	search_fields = ('subject', 'user__display_name', 'user__email', 'message')
	ordering = ('-created_at',)
	readonly_fields = ('created_at', 'updated_at', 'resolved_at')

	fieldsets = (
		('Main', {'fields': ('user', 'subject', 'message', 'status')}),
		('Assignment', {'fields': ('assigned_to',)}),
		('Dates', {'fields': ('created_at', 'updated_at', 'resolved_at')}),
	)


@admin.register(TicketReply)
class TicketReplyAdmin(admin.ModelAdmin):
	list_display = ('ticket', 'user', 'is_from_support', 'created_at')
	list_filter = ('is_from_support', 'created_at')
	search_fields = ('ticket__subject', 'user__display_name', 'message')
	ordering = ('created_at',)
