"""URLs for support app."""
from django.urls import path
from . import views

urlpatterns = [
    path('tickets/', views.TicketListCreateView.as_view(), name='ticket-list-create'),
    path('tickets/<int:ticket_id>/', views.TicketDetailView.as_view(), name='ticket-detail'),
    path('tickets/<int:ticket_id>/replies/', views.TicketReplyView.as_view(), name='ticket-reply'),
    path('tickets/<int:ticket_id>/close/', views.TicketCloseView.as_view(), name='ticket-close'),
]
