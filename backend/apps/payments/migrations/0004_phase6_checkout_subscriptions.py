import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('payments', '0003_phase4_accounting_and_prices'),
        ('users', '0003_phase5_user_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='currency',
            field=models.CharField(default='IRR', max_length=8),
        ),
        migrations.AddField(
            model_name='transaction',
            name='duration_months',
            field=models.PositiveSmallIntegerField(
                choices=[(1, '1 month'), (3, '3 months'), (6, '6 months'), (12, '12 months')],
                default=1,
            ),
        ),
        migrations.AddField(
            model_name='transaction',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='transaction',
            name='failure_reason',
            field=models.CharField(blank=True, max_length=250),
        ),
        migrations.AddField(
            model_name='transaction',
            name='gateway_authority',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='transaction',
            name='idempotency_key',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='payment_gateway',
            field=models.CharField(default='sandbox', max_length=50),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['user', 'status', 'created_at'], name='payment_user_status_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['status', 'verified_at'], name='payment_status_verified_idx'),
        ),
        migrations.AddConstraint(
            model_name='transaction',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gt', 0)), name='payment_amount_positive'),
        ),
        migrations.AddConstraint(
            model_name='transaction',
            constraint=models.UniqueConstraint(
                condition=models.Q(('idempotency_key', ''), _negated=True),
                fields=('user', 'idempotency_key'),
                name='unique_user_payment_idempotency',
            ),
        ),
        migrations.AddConstraint(
            model_name='transaction',
            constraint=models.UniqueConstraint(
                condition=models.Q(('gateway_authority', ''), _negated=True),
                fields=('gateway_authority',),
                name='unique_payment_gateway_authority',
            ),
        ),
        migrations.CreateModel(
            name='UserSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subscription_type', models.CharField(choices=[('silver', 'silver'), ('gold', 'gold')], max_length=20)),
                ('starts_at', models.DateTimeField()),
                ('expires_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('active', 'active'), ('expired', 'expired'), ('replaced', 'replaced')], default='active', max_length=12)),
                ('cancel_at_period_end', models.BooleanField(default=False)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('transaction', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_period', to='payments.transaction')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_periods', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-expires_at', '-id'],
                'indexes': [models.Index(fields=['user', 'status', 'expires_at'], name='subscription_user_state_idx')],
                'constraints': [models.CheckConstraint(condition=models.Q(('expires_at__gt', models.F('starts_at'))), name='subscription_expiry_after_start')],
            },
        ),
    ]
