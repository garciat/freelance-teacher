export type BaseLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export const BaseLayout: React.FC<BaseLayoutProps> = (
  { title, children },
) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />

      <title>{`${title} - Freelance Teacher`}</title>

      <link rel="stylesheet" href="/static/main.css" />

      <script type="importmap">
        {JSON.stringify({
          "imports": {
            "@/app/frontend/": "/frontend/",
            "@/app/shared/": "/shared/",
            "@/lib/": "/lib/",
            "react": "https://cdn.jsdelivr.net/npm/react/+esm",
            "react/jsx-runtime":
              "https://cdn.jsdelivr.net/npm/react/jsx-runtime/+esm",
            "react-dom/client":
              "https://cdn.jsdelivr.net/npm/react-dom/client/+esm",
            "@react-pdf/renderer":
              "https://cdn.jsdelivr.net/npm/@react-pdf/renderer/+esm",
          },
        })}
      </script>
    </head>
    <body>
      {children}
      <div id="toast" popover=""></div>
      <script type="module" src="/frontend/toast.tsx"></script>
    </body>
  </html>
);
