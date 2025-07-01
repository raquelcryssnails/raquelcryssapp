import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  iconClassName?: string;
  href?: string;
}

export function MetricCard({ title, value, icon: Icon, description, className, iconClassName, href }: MetricCardProps) {
  const CardComponent = (
    <Card className={cn(
      "shadow-lg rounded-xl overflow-hidden h-full flex flex-col",
      href ? "transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30" : "",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-card/50">
        <CardTitle className="text-sm font-medium font-headline text-card-foreground/80">{title}</CardTitle>
        <Icon className={cn("h-5 w-5 text-muted-foreground", iconClassName)} />
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-3xl font-bold font-headline text-gradient">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground pt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {CardComponent}
      </Link>
    );
  }

  return CardComponent;
}
