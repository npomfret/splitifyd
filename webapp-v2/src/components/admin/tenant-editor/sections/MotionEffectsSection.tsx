import { AdminFormInput, AdminFormSection, AdminFormToggle, SubsectionHeader } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function MotionEffectsSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Motion & Effects' description='Animation settings and feature flags' testId='section-motion-effects'>
            <div class='space-y-4'>
                <SubsectionHeader title='Feature Flags' />
                <div class='space-y-3'>
                    <AdminFormToggle
                        label='Parallax / Aurora Background'
                        description='Animated gradient background'
                        checked={formData.enableParallax}
                        onChange={(v) => update({ enableParallax: v })}
                        disabled={isSaving}
                        testId='enable-parallax-checkbox'
                    />
                    <AdminFormToggle
                        label='Magnetic Hover'
                        description='Buttons follow cursor'
                        checked={formData.enableMagneticHover}
                        onChange={(v) => update({ enableMagneticHover: v })}
                        disabled={isSaving}
                        testId='enable-magnetic-hover-checkbox'
                    />
                    <AdminFormToggle
                        label='Scroll Reveal'
                        description='Animate elements on scroll'
                        checked={formData.enableScrollReveal}
                        onChange={(v) => update({ enableScrollReveal: v })}
                        disabled={isSaving}
                        testId='enable-scroll-reveal-checkbox'
                    />
                </div>
                <SubsectionHeader title='Durations (ms)' />
                <div class='grid grid-cols-5 gap-4'>
                    <AdminFormInput
                        label='Instant'
                        type='number'
                        value={formData.motionDurationInstant}
                        onChange={(v) => update({ motionDurationInstant: parseInt(v) || 0 })}
                        disabled={isSaving}
                        testId='motion-duration-instant-input'
                    />
                    <AdminFormInput
                        label='Fast'
                        type='number'
                        value={formData.motionDurationFast}
                        onChange={(v) => update({ motionDurationFast: parseInt(v) || 0 })}
                        disabled={isSaving}
                        testId='motion-duration-fast-input'
                    />
                    <AdminFormInput
                        label='Base'
                        type='number'
                        value={formData.motionDurationBase}
                        onChange={(v) => update({ motionDurationBase: parseInt(v) || 0 })}
                        disabled={isSaving}
                        testId='motion-duration-base-input'
                    />
                    <AdminFormInput
                        label='Slow'
                        type='number'
                        value={formData.motionDurationSlow}
                        onChange={(v) => update({ motionDurationSlow: parseInt(v) || 0 })}
                        disabled={isSaving}
                        testId='motion-duration-slow-input'
                    />
                    <AdminFormInput
                        label='Glacial'
                        type='number'
                        value={formData.motionDurationGlacial}
                        onChange={(v) => update({ motionDurationGlacial: parseInt(v) || 0 })}
                        disabled={isSaving}
                        testId='motion-duration-glacial-input'
                    />
                </div>
                <SubsectionHeader title='Easing Curves' />
                <div class='grid grid-cols-2 gap-4'>
                    <AdminFormInput
                        label='Standard'
                        value={formData.motionEasingStandard}
                        onChange={(v) => update({ motionEasingStandard: v })}
                        placeholder='cubic-bezier(0.4, 0, 0.2, 1)'
                        disabled={isSaving}
                        monospace
                        testId='motion-easing-standard-input'
                    />
                    <AdminFormInput
                        label='Decelerate'
                        value={formData.motionEasingDecelerate}
                        onChange={(v) => update({ motionEasingDecelerate: v })}
                        placeholder='cubic-bezier(0, 0, 0.2, 1)'
                        disabled={isSaving}
                        monospace
                        testId='motion-easing-decelerate-input'
                    />
                    <AdminFormInput
                        label='Accelerate'
                        value={formData.motionEasingAccelerate}
                        onChange={(v) => update({ motionEasingAccelerate: v })}
                        placeholder='cubic-bezier(0.4, 0, 1, 1)'
                        disabled={isSaving}
                        monospace
                        testId='motion-easing-accelerate-input'
                    />
                    <AdminFormInput
                        label='Spring'
                        value={formData.motionEasingSpring}
                        onChange={(v) => update({ motionEasingSpring: v })}
                        placeholder='cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        disabled={isSaving}
                        monospace
                        testId='motion-easing-spring-input'
                    />
                </div>
            </div>
        </AdminFormSection>
    );
}
