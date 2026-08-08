"""Models for users app.

Custom user model placeholder.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """Custom user model for the project. Extend as needed."""

    # Add additional fields here if required in future

    def __str__(self):
        return self.username
