from django.contrib import admin
from .models import ArtistMonthlyStatement, SubscriptionPrice, Transaction, UserSubscription


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
	list_display = ('user', 'subscription_type', 'duration_months', 'amount', 'currency', 'status', 'payment_gateway', 'created_at')
	list_filter = ('status', 'subscription_type', 'duration_months', 'payment_gateway', 'created_at')
	search_fields = ('user__display_name', 'user__email', 'reference_id', 'gateway_authority')
	ordering = ('-created_at',)
	readonly_fields = ('gateway_authority', 'reference_id', 'verified_at', 'created_at', 'updated_at')

	fieldsets = (
		('Main', {'fields': ('user', 'subscription_type', 'duration_months', 'amount', 'currency', 'status')}),
		('Payment Info', {'fields': ('reference_id', 'payment_gateway', 'gateway_authority', 'failure_reason', 'payment_data')}),
		('Dates', {'fields': ('expires_at', 'created_at', 'updated_at', 'verified_at')}),
	)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
	list_display = ('user', 'subscription_type', 'starts_at', 'expires_at', 'status', 'cancel_at_period_end')
	list_filter = ('subscription_type', 'status', 'cancel_at_period_end')
	search_fields = ('user__display_name', 'user__email', 'transaction__reference_id')
	readonly_fields = ('transaction', 'user', 'subscription_type', 'starts_at', 'expires_at', 'created_at', 'updated_at')
	ordering = ('-expires_at',)


@admin.register(ArtistMonthlyStatement)
class ArtistMonthlyStatementAdmin(admin.ModelAdmin):
	list_display = ('artist', 'period', 'unique_listeners', 'stream_count', 'reward_amount', 'status', 'settled_at')
	list_filter = ('status', 'period')
	search_fields = ('artist__stage_name', 'artist__user__email')
	readonly_fields = ('created_at', 'updated_at', 'settled_at')
	ordering = ('-period', 'artist__stage_name')
