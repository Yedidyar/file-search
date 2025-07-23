import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="p-2">
      <h3>Welcome to TanStack Start + NX!</h3>
      <p>This is your home page.</p>
    </div>
  );
}
