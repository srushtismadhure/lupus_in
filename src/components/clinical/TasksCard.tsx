import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TasksCard({ tasks }: { tasks: fhir4.Task[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Care Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No care tasks available.</p>}
        <ul className="space-y-2">
          {tasks.map(task => (
            <li key={task.id} className="border-b border-[#E4E7EC] pb-2 last:border-0">
              <p className="text-sm font-medium text-foreground">{task.description ?? "Task"}</p>
              <p className="text-xs text-muted-foreground">
                {task.status} / {task.priority ?? "unspecified priority"}
                {task.restriction?.period?.end ? ` · due ${task.restriction.period.end}` : ""}
                {task.owner?.display ? ` · owner ${task.owner.display}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
