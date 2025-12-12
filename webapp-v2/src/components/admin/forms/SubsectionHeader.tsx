interface SubsectionHeaderProps {
    title: string;
}

export function SubsectionHeader({ title }: SubsectionHeaderProps) {
    return <h4 className='text-xs font-semibold text-text-muted uppercase tracking-wide'>{title}</h4>;
}
