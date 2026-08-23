# Auto Media Publisher

Auto Media Publisher is a desktop-first media publishing tool that streamlines recurring video workflows from local processing through YouTube publishing.

Read more:
https://kylezhao101.com/content/projects/auto-media-publisher

## Contents

1. [Overview](#overview)
2. [Desktop Application](#desktop-application)
3. [Organization Workspaces](#organization-workspaces)
4. [Platform Support](#platform-support)
5. [Personal Credentials](#personal-credentials)
6. [Original Azure Cloud Implementation](#original-azure-cloud-implementation)

---

## Overview

AMP is primarily a cross-platform desktop application built with Electron, React, and a Python worker.

The desktop app handles local media processing with FFmpeg and supports both:

- Personal workspaces using locally stored Google OAuth credentials
- Organization workspaces using a deployed FastAPI + Supabase backend for shared presets, members, role-based access, invitations, and centrally managed YouTube connections

A separate Azure-based cloud pipeline was developed earlier in the project for asynchronous media processing, but the application later moved to a desktop-first architecture because large recordings and long-running transcoding workloads made cloud storage and compute costs impractical.

---

## Desktop Application

The desktop app is the primary AMP workflow.

Users can:

- select multiple local video clips
- select a custom thumbnail
- render and merge clips with FFmpeg
- apply audio processing
- choose CPU or GPU encoding
- configure title, description, visibility, and playlists
- upload directly to YouTube
- monitor render and upload progress
- cancel active jobs
- retry uploads using existing renders
- receive desktop notifications
- open local logs and rendered output files
- switch between Personal and Organization workspaces

### Desktop Architecture

- Electron
- React
- Vite
- TypeScript
- Python
- FFmpeg / FFprobe
- PyInstaller
- electron-builder
- GitHub Actions

Long-running rendering and publishing work runs in a Python worker process while Electron manages the desktop UI and IPC communication.

---

## Organization Workspaces

Organization workspaces support shared publishing workflows for teams.

Features include:

- organization creation and deletion
- owner, admin, publisher, and member roles
- email invitations
- shared publishing presets
- organization-level YouTube connections
- organization playlist access
- member management
- organization activity/audit history

The backend is deployed using:

- FastAPI
- Supabase
- PostgreSQL
- Resend

### Authentication

Personal YouTube credentials remain stored locally on the user's device.

Organization YouTube refresh tokens are encrypted server-side before being stored. When a member publishes through an organization, the backend exchanges the refresh token for a short-lived Google access token so the desktop worker never receives the organization's long-lived refresh credential.

---

## Platform Support

- Windows: supported
- macOS: experimental
- Linux: not officially tested

macOS builds are unsigned and may require manually allowing the application to run.

---

## Personal Credentials

AMP does not ship with Google Cloud credentials for Personal workspaces.

Users who publish through Personal must import their own Google OAuth credentials JSON. Credentials and tokens remain in the local application data directory.

Organization members do not need to distribute shared Google credentials between devices.

---

## Original Azure Cloud Implementation

AMP originally used a separate cloud-native processing pipeline built on Azure.

![System Architecture](./auto-media-publisher.png)

This implementation used:

- React/Vite frontend
- FastAPI API
- Azure Blob Storage
- Azure Queue Storage
- Azure Container Apps
- background media workers

The system supported asynchronous uploads, transcoding, and publishing jobs. It was later deprioritized in favor of the desktop-first workflow because source recordings often reached tens of gigabytes and required long-running processing workloads, making cloud compute and storage unnecessarily expensive for the intended use case.

