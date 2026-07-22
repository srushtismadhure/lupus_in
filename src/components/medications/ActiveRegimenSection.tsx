import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORY_GROUP_LABELS, type MedicationCategoryGroup } from "@/lib/medication-config";
import type { MedicationRegimenItem } from "@/lib/medication-types";
import { MedicationRegimenCard } from "./MedicationRegimenCard";

const GROUP_ORDER: MedicationCategoryGroup[] = ["lupus-nephritis-treatment", "kidney-cardiovascular-support", "preventive-supportive-care", "other"];

interface ActiveRegimenSectionProps {
  regimenByGroup: Record<MedicationCategoryGroup, MedicationRegimenItem[]>;
  canManageOrders: boolean;
  onAddMedication: () => void;
  onHold: (item: MedicationRegimenItem) => void;
  onStop: (item: MedicationRegimenItem) => void;
  onReplace: (item: MedicationRegimenItem) => void;
  onSign: (item: MedicationRegimenItem) => void;
  onReconcile: (item: MedicationRegimenItem) => void;
  onViewEvidence: (item: MedicationRegimenItem) => void;
}

export function ActiveRegimenSection({
  regimenByGroup,
  canManageOrders,
  onAddMedication,
  onHold,
  onStop,
  onReplace,
  onSign,
  onReconcile,
  onViewEvidence,
}: ActiveRegimenSectionProps) {
  const totalCount = GROUP_ORDER.reduce((sum, group) => sum + regimenByGroup[group].length, 0);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1F2430]">Active regimen</h2>
        {canManageOrders && (
          <Button size="sm" onClick={onAddMedication}>
            Add medication
          </Button>
        )}
      </div>

      {totalCount === 0 ? (
        <Card className="border-dashed bg-[#F8FBFD]">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-[#4F5E70]">
            <p>No active medication orders found.</p>
            {canManageOrders && (
              <Button size="sm" onClick={onAddMedication}>
                Add medication
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.filter(group => regimenByGroup[group].length > 0).map(group => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4F5E70]">{CATEGORY_GROUP_LABELS[group]}</h3>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {regimenByGroup[group].map(item => (
                  <MedicationRegimenCard
                    key={item.id}
                    item={item}
                    canManageOrders={canManageOrders}
                    onHold={() => onHold(item)}
                    onStop={() => onStop(item)}
                    onReplace={() => onReplace(item)}
                    onSign={() => onSign(item)}
                    onReconcile={() => onReconcile(item)}
                    onViewEvidence={() => onViewEvidence(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
