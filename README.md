# Eru Social Web
> Eru social web designed for my Erciyes University Design Project.


<a href="https://www.youtube.com/watch?v=3gyEawR3KL4">
  <img src="https://github.com/burakboduroglu/eru-social-web-app/assets/80620802/b5173878-5bc4-45ad-87fc-43a4fdab0b09" />
  <p>YouTube Link</p>
</a>

## Table of Contents
- [Eru Social Web](#eru-social-web)
  - [Table of Contents](#table-of-contents)
  - [About The Project](#about-the-project)
  - [Technologies](#technologies)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [License](#license)
  - [Acknowledgements](#acknowledgements)

## About The Project
This project is designed for my Erciyes University Design Project. It is a social web application that allows users to share their posts, follow other users, like posts, comment on posts, create communities, and join communities. It is a web application that allows users to share their posts, follow other users, like posts, comment on posts, create communities, and join communities.

## Technologies
- `Next.js` for Server Side Rendering
- `React.js` for Frontend
- `Tailwind CSS` for Styling
- `Clerk` for Authentication
- `TypeScript` for Type Checking
- `MongoDB` for Database
- `Zod` for Validation

## Getting Started
To get a local copy up and running, follow these steps.

### Prerequisites
* [Bun](https://bun.sh)
```sh
curl -fsSL https://bun.sh/install | bash
```

### Installation
1. Clone the repo
```sh
git clone https://github.com/burakboduroglu/eru-social-web-app.git
cd eru-social-web-app
```
2. Install the packages
```sh
bun install
```
3. Set up the environment variables in `.env.local`
```.env
MONGODB_URL=
CLERK_SECRET_KEY=
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
NEXT_CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```
4. Run the project
```sh
bun run dev
```

## License
Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements
* [Next.js](https://nextjs.org/)
* [React.js](https://reactjs.org/)
* [Tailwind CSS](https://tailwindcss.com/)
* [Clerk](https://clerk.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* [MongoDB](https://www.mongodb.com/)
* [Zod](https://zod.dev/)
