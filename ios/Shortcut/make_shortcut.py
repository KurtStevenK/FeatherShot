#!/usr/bin/env python3
"""Writes the unsigned FeatherShot shortcut: Take Screenshot → Annotate Screenshot (FeatherShot).

    python3 ios/Shortcut/make_shortcut.py out/FeatherShot-unsigned.shortcut
    shortcuts sign --mode anyone --input out/FeatherShot-unsigned.shortcut --output FeatherShot.shortcut
"""
import plistlib
import sys

SCREENSHOT_UUID = "6F2B1C1E-9A0B-4E0B-9C7E-FEA7E5B07001"

shortcut = {
    "WFWorkflowClientVersion": "2607.0.2",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 463140863,   # blue
        "WFWorkflowIconGlyphNumber": 59511,      # camera viewfinder
    },
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": [],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowTypes": [],
    "WFWorkflowHasShortcutInputVariables": False,
    "WFQuickActionSurfaces": [],
    "WFWorkflowActions": [
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.takescreenshot",
            "WFWorkflowActionParameters": {"UUID": SCREENSHOT_UUID},
        },
        {
            "WFWorkflowActionIdentifier": "xyz.kainzmayer.feathershot.OpenScreenshotIntent",
            "WFWorkflowActionParameters": {
                "AppIntentDescriptor": {
                    "AppIntentIdentifier": "OpenScreenshotIntent",
                    "BundleIdentifier": "xyz.kainzmayer.feathershot",
                    "Name": "FeatherShot",
                    "TeamIdentifier": "XPPUZJDN56",
                },
                "screenshot": {
                    "Value": {
                        "OutputName": "Screenshot",
                        "OutputUUID": SCREENSHOT_UUID,
                        "Type": "ActionOutput",
                    },
                    "WFSerializationType": "WFTextTokenAttachment",
                },
            },
        },
    ],
}

with open(sys.argv[1], "wb") as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_BINARY)
