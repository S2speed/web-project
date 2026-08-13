"""URLs for support app."""
from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/read-all/', views.NotificationReadAllView.as_view(), name='notification-read-all'),
    path('notifications/<int:notification_id>/read/', views.NotificationReadView.as_view(), name='notification-read'),
    path('notifications/<int:notification_id>/', views.NotificationDeleteView.as_view(), name='notification-delete'),
    path('tickets/', views.TicketListCreateView.as_view(), name='ticket-list-create'),
    path('tickets/<int:ticket_id>/', views.TicketDetailView.as_view(), name='ticket-detail'),
    path('tickets/<int:ticket_id>/replies/', views.TicketReplyView.as_view(), name='ticket-reply'),
    path('tickets/<int:ticket_id>/close/', views.TicketCloseView.as_view(), name='ticket-close'),
]
