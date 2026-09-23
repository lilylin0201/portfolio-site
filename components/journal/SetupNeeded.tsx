import { setupProblems } from "@/lib/journal/store";

// Shown on the live site until storage and the password are set up in Vercel.
export function SetupNeeded() {
  const problems = setupProblems();
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border p-8">
        <h1 className="mb-2 text-2xl">Almost ready</h1>
        <p className="mb-4 text-gray-600">Finish these in your Vercel project, then redeploy (Deployments → ⋯ → Redeploy):</p>
        <ol className="list-decimal space-y-2 pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
