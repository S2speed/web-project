import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def seed_subscription_prices(apps, schema_editor):
    SubscriptionPrice = apps.get_model('payments', 'SubscriptionPrice')
    SubscriptionPrice.objects.get_or_create(
        subscription_type='silver',
        defaults={'price': '7.99', 'duration_days': 30},
    )
    SubscriptionPrice.objects.get_or_create(
        subscription_type='gold',
        defaults={'price': '12.99', 'duration_days': 30},
    )


class Migration(migrations.Migration):
    dependencies = [
        ('music', '0004_artist_verification_workflow'),
        ('payments', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='subscriptionprice',
            name='price',
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='amount',
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.CreateModel(
            name='ArtistMonthlyStatement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period', models.DateField(help_text='First day of the accounting month.')),
                ('unique_listeners', models.PositiveIntegerField(default=0)),
                ('stream_count', models.PositiveBigIntegerField(default=0)),
                ('reward_amount', models.DecimalField(decimal_places=4, default=0, max_digits=16)),
                ('status', models.CharField(choices=[('pending', 'pending'), ('settled', 'settled')], default='pending', max_length=12)),
                ('settled_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('artist', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='monthly_statements', to='music.artist')),
                ('settled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settled_artist_statements', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-period', 'artist__stage_name']},
        ),
        migrations.AddConstraint(
            model_name='artistmonthlystatement',
            constraint=models.UniqueConstraint(fields=('artist', 'period'), name='unique_artist_monthly_statement'),
        ),
        migrations.RunPython(seed_subscription_prices, migrations.RunPython.noop),
    ]
