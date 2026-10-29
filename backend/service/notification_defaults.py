"""Default mobile notification rules (docs/mobile-notification-strategy.md v1.0).

User-facing copy is stored as i18n keys (notif.*); resolve via localize_rules().
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List


def default_notification_rules() -> Dict[str, Any]:
    """Canonical rule pack; string fields that start with notif. are i18n keys."""
    return {
        "version": "1.0",
        "doc": "mobile-notification-strategy.md",
        "enabled": True,
        "principles": {
            "value_first": True,
            "require_l1_before_l2": True,
            "max_l2_per_install": 1,
            "forbid_cold_start_l2": True,
            "in_app_toggle_required": True,
            "prefer_sparse": True,
        },
        "blacklist_triggers": [
            "cold_start",
            "register_success_instant",
            "login_page",
            "onboarding_animating",
            "background_to_foreground",
            "editing_todo_or_input_focused",
            "l2_already_denied",
            "l1_cooldown_active",
        ],
        "permission_scenes": [
            {
                "id": "N-DUE",
                "enabled": True,
                "priority": "P0",
                "channel": "due",
                "trigger": "first_due_date_or_due_reminder_toggle",
                "value": "notif.scene.N-DUE.value",
                "l1": {
                    "title": "notif.scene.N-DUE.l1.title",
                    "body": "notif.scene.N-DUE.l1.body",
                    "primary": "notif.scene.N-DUE.l1.primary",
                    "secondary": "notif.scene.N-DUE.l1.secondary",
                },
            },
            {
                "id": "N-STREAK",
                "enabled": True,
                "priority": "P1",
                "channel": "streak",
                "trigger": "streak_ge_3_and_user_opts_in",
                "min_streak_days": 3,
                "value": "notif.scene.N-STREAK.value",
                "l1": {
                    "title": "notif.scene.N-STREAK.l1.title",
                    "body": "notif.scene.N-STREAK.l1.body",
                    "primary": "notif.scene.N-STREAK.l1.primary",
                    "secondary": "notif.scene.N-STREAK.l1.secondary",
                },
            },
            {
                "id": "N-REPORT",
                "enabled": True,
                "priority": "P2",
                "channel": "report",
                "trigger": "first_weekly_report_and_opt_in",
                "value": "notif.scene.N-REPORT.value",
                "l1": {
                    "title": "notif.scene.N-REPORT.l1.title",
                    "body": "notif.scene.N-REPORT.l1.body",
                    "primary": "notif.scene.N-REPORT.l1.primary",
                    "secondary": "notif.scene.N-REPORT.l1.secondary",
                },
            },
            {
                "id": "N-SETTINGS",
                "enabled": True,
                "priority": "P0",
                "channel": "system",
                "trigger": "profile_notification_settings_enable",
                "value": "notif.scene.N-SETTINGS.value",
                "l1": {
                    "title": "notif.scene.N-SETTINGS.l1.title",
                    "body": "notif.scene.N-SETTINGS.l1.body",
                    "primary": "notif.scene.N-SETTINGS.l1.primary",
                    "secondary": "notif.scene.N-SETTINGS.l1.secondary",
                },
                "counts_toward_l1_month_cap": False,
            },
        ],
        "channels": {
            "due": {
                "label": "notif.channel.due.label",
                "enabled_default": True,
                "priority": "high",
                "android_channel_id": "due",
                "android_importance": "HIGH",
                "ios_category": "DUE",
                "sound_default": True,
                "quiet_respect": True,
                "allow_window_default": "08:00-22:00",
                "v1_send": True,
            },
            "due_day": {
                "label": "notif.channel.due_day.label",
                "enabled_default": True,
                "priority": "high",
                "android_channel_id": "due",
                "android_importance": "HIGH",
                "ios_category": "DUE",
                "sound_default": True,
                "quiet_respect": True,
                "allow_window_default": "08:00-22:00",
                "v1_send": True,
            },
            "streak": {
                "label": "notif.channel.streak.label",
                "enabled_default": False,
                "priority": "medium",
                "android_channel_id": "streak",
                "android_importance": "DEFAULT",
                "ios_category": "STREAK",
                "sound_default": False,
                "quiet_respect": True,
                "allow_window_default": "20:00-21:00",
                "v1_send": True,
            },
            "report": {
                "label": "notif.channel.report.label",
                "enabled_default": False,
                "priority": "low",
                "android_channel_id": "report",
                "android_importance": "LOW",
                "ios_category": "REPORT",
                "sound_default": False,
                "quiet_respect": True,
                "allow_window_default": "user_selected",
                "v1_send": True,
            },
            "system": {
                "label": "notif.channel.system.label",
                "enabled_default": True,
                "priority": "high",
                "android_channel_id": "system",
                "android_importance": "HIGH",
                "ios_category": None,
                "sound_default": True,
                "quiet_respect": False,
                "bypass_quiet": True,
                "v1_send": True,
            },
            "promo": {
                "label": "notif.channel.promo.label",
                "enabled_default": False,
                "priority": "low",
                "android_channel_id": "promo",
                "android_importance": "LOW",
                "ios_category": None,
                "sound_default": False,
                "quiet_respect": True,
                "v1_send": False,
                "note": "notif.channel.promo.note",
            },
        },
        "frequency": {
            "l1_scene_cooldown_days": 7,
            "l1_global_cooldown_hours": 24,
            "l1_month_max": 3,
            "due_main_per_task_per_day": 1,
            "due_upcoming_optional_per_task_per_day": 1,
            "due_day_digest_min_items": 3,
            "streak_per_day": 1,
            "streak_cancel_if_opened_app": True,
            "report_per_week": 1,
            "global_non_system_per_hour": 2,
            "global_non_system_per_day": 8,
        },
        "quiet_hours": {
            "enabled": True,
            "start": "22:00",
            "end": "08:00",
            "defer_due_to_next_window": True,
            "system_bypass": True,
            "user_override_allow": True,
        },
        "l3_settings_guide": {
            "enabled": True,
            "honest_copy": True,
            "cooldown_days": 14,
            "max_in_window": 2,
            "settings_entry_always_available": True,
            "forbid_fake_system_dialogs": True,
        },
        "ios": {
            "api": "UNUserNotificationCenter.requestAuthorization",
            "provisional_allowed": False,
            "critical_default_off": True,
            "time_sensitive_due_day_only": True,
        },
        "android": {
            "runtime_permission": "POST_NOTIFICATIONS",
            "exact_alarm_separate_from_notif_perm": True,
            "create_channels_before_first_notify": True,
        },
        "product_map": {
            "due_date": "N-DUE / due",
            "streak": "N-STREAK / streak (default off)",
            "weekly_report": "N-REPORT / report (optional)",
            "share_poster": "not_a_permission_scene",
            "cloud_sync_success": "never_notify",
        },
    }


CHANNEL_IDS: List[str] = ["due", "due_day", "streak", "report", "system", "promo"]
SCENE_IDS: List[str] = ["N-DUE", "N-STREAK", "N-REPORT", "N-SETTINGS"]


def clone_default_rules() -> Dict[str, Any]:
    return deepcopy(default_notification_rules())


def localize_rules(rules: Dict[str, Any], lang: str = "en") -> Dict[str, Any]:
    """Resolve notif.* i18n keys in a rules pack for the given language."""
    from common.i18n import t

    def resolve(value: Any) -> Any:
        if isinstance(value, str) and value.startswith("notif."):
            return t(value, lang=lang)
        if isinstance(value, dict):
            return {k: resolve(v) for k, v in value.items()}
        if isinstance(value, list):
            return [resolve(v) for v in value]
        return value

    return resolve(deepcopy(rules))
