# Project Context

## Overview

Logos Data Collection System - decentralized system for collecting and analyzing digital rights data using Waku (messaging) and Codex (storage).

## Components

- **Library**: Core crawling/analysis logic with CLI
- **Node**: Uses library + Waku/Codex integration
- **Notifier**: Waku messaging → Discord notifications

## Tech Stack

TypeScript, Puppeteer, Commander.js, Waku, Codex

## Architecture

Config-driven crawling with pluggable analysis strategies. Monorepo structure with shared library.
