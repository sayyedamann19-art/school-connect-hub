# School Connect Hub

School Parent–Teacher PWA — V1 Foundation

Build the foundation for a professional, responsive School Parent–Teacher PWA.

Tech Stack

Lovable — development

GitHub — source control

Supabase — authentication, database, storage, realtime where needed

Cloudflare Pages — production hosting

Client's existing domain

Do NOT use Vercel

Structure the project for deployment through GitHub → Cloudflare Pages.

User Roles

Create role-based architecture for:

Admin

Full school management access.

Teacher

Access assigned students/classes and add permitted teacher notes and Character Card points.

Parent

Access only their own linked children.

Use Supabase Authentication + Row Level Security (RLS). Parent access must be enforced at the database level, not only through frontend filtering.

V1 Modules

Create the basic structure/routes for:

Login

Parent Dashboard

Linked children

Student cards

Student selection

Student Profile

Name

Class/division

Roll number

DOB

Photo

Attendance

Teacher notes

Character Card

Attendance

Present

Absent

Late

Left early

Other

Monthly/yearly percentages

Trends

Teacher Notes

Teacher

Date

Subject/class

Note

Character Card

Positive points

Negative points

Current score

Point history

Reason/comment

Teacher

Date

Admin Area

Teacher Area

Do not fully implement the modules yet. Create their foundation and routing; we will build each module separately.

Database Foundation

Prepare Supabase tables/relationships for:

Users

Parents

Teachers

Students

Parent–Student relationships

Classes/Divisions

Attendance

Teacher Notes

Character Card Points

Parent–student relationships must be persistent and changeable only by authorized Admins.

PWA

Set up the application as a responsive PWA:

Mobile-first

Phone, tablet, desktop support

Installable

App manifest

Service worker/PWA configuration

Authentication state handling

Prepare the architecture for push notifications. The final app should request notification permission on first open.

Design System

Create a clean, premium, modern school-management UI.

Use:

Light/white backgrounds

Deep navy/blue primary color

Subtle status colors

Rounded cards

Soft shadows

Clear typography

Consistent icons

Strong spacing and hierarchy

Responsive layouts

Avoid excessive gradients, animations, glassmorphism, or childish designs.

Reusable Components

Create reusable components for:

Header

Sidebar

Mobile navigation

Cards

Student cards

Profile sections

Statistics

Tables

Forms

Buttons

Status badges

Loading states

Empty states

Error states

Dialogs

Toasts

Security

Implement the foundation for:

Authentication

Role-based access

Protected routes

Supabase RLS

Secure parent → student access

Teacher permissions

Admin permissions

Never expose student data publicly.

V1 Scope

Do not add unrelated modules such as:

Fees/payments

Transport

Timetable

Chat/messaging

Public school website

Unplanned analytics

Unrelated management features

Goal

At the end of this prompt, the project should have:

Application shell

Routing

Role architecture

Responsive design system

PWA foundation

Supabase-ready database structure

Authentication foundation

Security/RLS foundation

Parent, Teacher and Admin areas

Reusable components

Do not fully build the individual modules yet. We will implement them step-by-step in subsequent prompts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e2d9199d-8106-4437-bb9b-5fe7dc4b640e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
