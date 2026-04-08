# HamloProd

Archive / case-file style music producer website on Next.js App Router with TypeScript, Tailwind CSS v4 and Supabase-ready architecture.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand
- React Hook Form + Zod
- Supabase client scaffolding

## Current scope

- Public routes: home, beats archive, tracks, artists
- Admin routes: login, dashboard, beats CRUD, tracks CRUD, artists CRUD
- Sticky global audio player powered by Zustand
- Typed mock data as a temporary source until Supabase tables are connected
- Public pages are read-only by design; content creation is reserved for admin flows

## Development

```bash
npm install
npm run dev
```

Local app runs at http://localhost:3000.

## Structure

```text
src/
	app/
		(public)/
		admin/
	components/
		admin/
		artists/
		beats/
		layout/
		player/
		tracks/
		ui/
	lib/
		auth/
		supabase/
		utils/
		validations/
	services/
	store/
	types/
```

## Next phase

- Connect Supabase auth and database tables
- Replace mock data loaders with Supabase queries
- Add admin create/update/delete forms and storage uploads
- Add Stripe checkout and order flow
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
