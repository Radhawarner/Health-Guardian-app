from firebase_functions import https_fn, scheduler_fn
from server import app, check_and_send_notifications

# Expose the FastAPI app as a Firebase Function named 'api'
api = https_fn.on_request(app)

# Expose the notification checker as a Scheduled Function running every 5 minutes
# Note: Google Cloud free tier includes Cloud Scheduler, running every 5 minutes is typical for cron limits.
@scheduler_fn.on_schedule(schedule="every 5 minutes")
def notification_checker(event: scheduler_fn.ScheduledEvent) -> None:
    try:
        check_and_send_notifications()
    except Exception as e:
        print(f"Error in notification checker: {e}")
