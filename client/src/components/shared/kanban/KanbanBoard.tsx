import { memo, ReactNode } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface KanbanColumn<T> {
  id: string;
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  activeItem?: T | null;
  renderActiveItem?: (item: T) => ReactNode;
}

export const KanbanBoard = memo(function KanbanBoard<T>({
  columns,
  onDragEnd,
  onDragStart,
  activeItem,
  renderActiveItem,
}: KanbanBoardProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div className="overflow-x-auto pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 min-w-max">
          {columns.map((column) => (
            <div key={column.id} className="flex-1 min-w-[280px] max-w-[320px]">
              <div className="p-3 rounded-t-lg border border-b-0 flex items-center justify-between bg-card">
                <h3 className="font-semibold text-ink">{column.title}</h3>
                <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {column.items.length}
                </span>
              </div>
              <div className="p-2 min-h-[400px] max-h-[70vh] overflow-auto rounded-b-lg border border-t-0 bg-card">
                <SortableContext items={column.items.map((item) => (item as { id: string }).id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {column.items.map((item) => (
                      <div key={(item as { id: string }).id}>{column.renderItem(item)}</div>
                    ))}
                  </div>
                </SortableContext>
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeItem && renderActiveItem ? (
            <div className="shadow-xl opacity-80 bg-background p-4 rounded-lg">
              {renderActiveItem(activeItem)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});
