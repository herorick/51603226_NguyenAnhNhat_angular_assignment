# Product Brief

## Overview
Family Finance Management helps a family plan one month's income across seven predefined budget jars, record spending against those jars, and review the month's budget performance. All monetary values use VND, and the backend is authoritative for financial calculations.

## Target users
Family members who manage or review the household's monthly income and spending.

## Core features (MVP — max 3)
1. Create one monthly plan per year and month by entering positive income; automatically allocate it across seven predefined jars using fixed rates totaling 100%.
2. Record, edit, and delete expenses assigned to a jar in an existing monthly plan; validate required fields and update jar totals.
3. View a monthly dashboard with income, spending, remaining balance, progress, and each jar's budget and performance.

## Out of scope (explicitly NOT building today)
- Customizing jar names or allocation rates, or adding and removing jars.
- Recurring expenses, splitting an expense across jars, or expense attachments.
- Multiple currencies or financial calculations performed authoritatively by the frontend.
- Authentication and multi-user access controls.

## Tech stack (align with your harness)
- Frontend: Angular
- Backend: ASP.NET Core / C#
- Data/storage: SQLite with Entity Framework Core
