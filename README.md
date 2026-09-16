# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## API endpoints

The backend runs on `http://localhost:5000` by default. Protected endpoints require:

```text
Authorization: Bearer <jwt-token>
```

### Authentication and users

- `POST /api/auth/register` - register a jobseeker or employer.
- `POST /api/auth/login` - log in and receive a JWT.
- `GET /api/auth/me` - get the authenticated user.
- `GET /api/user/public/:id` - get a public user profile.
- `PUT /api/user/profile` - update the authenticated user's profile.

### Email templates

Employer accounts can edit automated email messages from the **Email Templates** item in the dashboard sidebar, or at `/email-templates`. Platform admin accounts can use the same screen. If a separate admin account is needed, from the `backend` directory run:

```bash
npm run create-admin -- admin@example.com "your-password" "Platform Admin"
```


### Jobs

- `GET /api/jobs` - list open jobs. Supports `keyword`, `location`, `category`, `type`, `page`, and `limit` query parameters.
- `GET /api/jobs/:id` - get one job.
- `GET /api/jobs/employer/my-jobs` - get the authenticated employer's jobs and applicant counts.
- `POST /api/jobs` - create a job as an employer.
- `PUT /api/jobs/:id` - update an owned job.
- `PATCH /api/jobs/:id/close` - close or reopen an owned job.
- `DELETE /api/jobs/:id` - delete an owned job.

### Applications and applicants

- `POST /api/applications/:jobId` - submit an application. Supports guest applications and multipart resume uploads.
- `GET /api/applications/my-applications` - get the authenticated jobseeker's applications.
- `GET /api/applications/job/:jobId` - get all applications for an employer-owned job.
- `GET /api/applications/employer` - get all applications across the authenticated employer's jobs. Supports `jobId`, `status`, `page`, and `limit`.
- `GET /api/applications/employer/applicants` - get unique registered and guest applicants across the authenticated employer's jobs. Supports `jobId` and `status`.
- `GET /api/applications/:id` - get one application for its applicant or job owner.
- `PATCH /api/applications/:id/status` - update an application status as the job owner.
- `DELETE /api/applications/:id` - withdraw an application as the applicant.

Application statuses are `Applied`, `Under Review`, `Interviewing`, `Offered`, and `Rejected`.

### Analytics

- `GET /api/analytics/summary` - public platform summary.
- `GET /api/analytics` - authenticated employer dashboard analytics.
- `GET /api/analytics/job/:jobId` - status breakdown for an owned job.

# JOB-PORTAL-WITH-ATS
