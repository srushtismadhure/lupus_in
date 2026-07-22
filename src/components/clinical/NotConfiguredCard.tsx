import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotConfiguredCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
