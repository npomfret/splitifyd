import { Stack } from '@/components/ui';
import type { ComponentChildren } from 'preact';

type SlotName = 'left' | 'main' | 'right';

interface ResponsiveColumnsProps {
    /** Left sidebar content (hidden on mobile by default) */
    left?: ComponentChildren;
    /** Main content (always visible) */
    main: ComponentChildren;
    /** Right sidebar content */
    right?: ComponentChildren;
    /** Order of slots on mobile (default: ['main', 'right', 'left']) */
    mobileOrder?: SlotName[];
    /** Which slots to hide on mobile (default: ['left']) */
    mobileHidden?: SlotName[];
}

/**
 * Responsive multi-column layout that eliminates mobile/desktop component duplication.
 *
 * On desktop: 3-column grid (3 + 5 + 4 = 12 columns)
 * On mobile: Single column with configurable order and visibility
 *
 * Key feature: Each slot is rendered ONCE, then positioned via CSS.
 * This prevents the anti-pattern of rendering components twice with lg:hidden/hidden lg:block.
 *
 * @example
 * <ResponsiveColumns
 *   left={<MembersList />}
 *   main={<ExpensesList />}
 *   right={
 *     <>
 *       <BalancesSection />
 *       <ActivitySection />
 *     </>
 *   }
 *   mobileOrder={['main', 'right', 'left']}
 *   mobileHidden={['left']}
 * />
 */
export function ResponsiveColumns({
    left,
    main,
    right,
    mobileOrder = ['main', 'right', 'left'],
    mobileHidden = ['left'],
}: ResponsiveColumnsProps) {
    // Map slot names to their content and CSS classes
    const slots: Record<SlotName, { content: ComponentChildren; desktopClass: string; }> = {
        left: {
            content: left,
            desktopClass: 'lg:col-span-3',
        },
        main: {
            content: main,
            desktopClass: 'lg:col-span-5',
        },
        right: {
            content: right,
            desktopClass: 'lg:col-span-4',
        },
    };

    // Generate mobile order indices
    const mobileOrderMap = Object.fromEntries(
        mobileOrder.map((slot, index) => [slot, index]),
    ) as Record<SlotName, number>;

    // Render slots
    const renderedSlots = (Object.entries(slots) as [SlotName, typeof slots[SlotName]][]).map(([name, { content, desktopClass }]) => {
        if (!content) return null;

        const isHiddenOnMobile = mobileHidden.includes(name);
        const mobileOrderIndex = mobileOrderMap[name] ?? 99;

        return (
            <div
                key={name}
                className={`${desktopClass} ${isHiddenOnMobile ? 'hidden lg:block' : ''}`}
                style={{ order: `var(--mobile-order-${name}, ${mobileOrderIndex})` }}
            >
                <Stack spacing='md'>
                    {content}
                </Stack>
            </div>
        );
    });

    return (
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
            <div
                className='grid grid-cols-1 lg:grid-cols-12 gap-6'
                style={{
                    '--mobile-order-left': mobileOrderMap.left ?? 2,
                    '--mobile-order-main': mobileOrderMap.main ?? 0,
                    '--mobile-order-right': mobileOrderMap.right ?? 1,
                } as Record<string, number>}
            >
                {renderedSlots}
            </div>
        </div>
    );
}
