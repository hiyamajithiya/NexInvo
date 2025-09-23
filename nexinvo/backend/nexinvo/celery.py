"""
Celery configuration for NexInvo project.
"""
import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexinvo.settings')

app = Celery('nexinvo')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Configure Celery Beat (periodic tasks)
app.conf.beat_schedule = {
    # Example: Run cleanup task daily at midnight
    'cleanup-old-invoices': {
        'task': 'invoices.tasks.cleanup_old_drafts',
        'schedule': 86400.0,  # 24 hours in seconds
    },
    # Example: Generate monthly reports
    'generate-monthly-reports': {
        'task': 'reports.tasks.generate_monthly_reports',
        'schedule': 2592000.0,  # 30 days in seconds
    },
}

@app.task(bind=True)
def debug_task(self):
    """A debug task to test Celery is working."""
    print(f'Request: {self.request!r}')
    return 'Celery is working!'