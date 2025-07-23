import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="p-2">
      <h3>About</h3>
      <p>This is the about page.</p>
    </div>
  );
}
