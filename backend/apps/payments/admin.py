from django.contrib import admin
from .models import SubscriptionPrice, Transaction


@admin.register(SubscriptionPrice)
class SubscriptionPriceAdmin(admin.ModelAdmin):
	list_display = ('subscription_type', 'price', 'duration_days', 'updated_at')
	list_filter = ('subscription_type',)
	readonly_fields = ('updated_at',)

	def save_model(self, request, obj, form, change):
		obj.updated_by = request.user
		super().save_model(request, obj, form, change)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
	list_display = ('user', 'subscription_type', 'amount', 'status', 'created_at')
	list_filter = ('status', 'subscription_type', 'created_at')
	search_fields = ('user__display_name', 'user__email', 'reference_id')
	ordering = ('-created_at',)
	readonly_fields = ('created_at', 'updated_at')

	fieldsets = (
		('Main', {'fields': ('user', 'subscription_type', 'amount', 'status')}),
		('Payment Info', {'fields': ('reference_id', 'payment_gateway', 'payment_data')}),
		('Dates', {'fields': ('created_at', 'updated_at', 'verified_at')}),
	)
