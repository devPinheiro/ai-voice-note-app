import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type PageHeaderProps = HTMLAttributes<HTMLDivElement>
type PageHeaderHeadingProps = HTMLAttributes<HTMLHeadingElement>
type PageHeaderDescriptionProps = HTMLAttributes<HTMLParagraphElement>
type PageActionsProps = HTMLAttributes<HTMLDivElement>

const PageHeader = ({ className, children, ...props }: PageHeaderProps) => (
    <section
        className={cn(
            'mx-auto flex flex-col items-start gap-2 px-4 py-8 md:py-12 md:pb-8 lg:py-12 lg:pb-10',
            className
        )}
        {...props}
    >
        {children}
    </section>
);

const PageHeaderHeading = ({ className, ...props }: PageHeaderHeadingProps) => (
    <h1
        className={cn(
            'text-3xl font-bold leading-tight tracking-tighter md:text-4xl lg:leading-[1.1]',
            className
        )}
        {...props}
    />
);

const PageHeaderDescription = ({ className, ...props }: PageHeaderDescriptionProps) => (
    <p 
        className={cn(
            'max-w-2xl text-balance text-lg font-light text-foreground',
            className
        )}
        {...props}
    />
);

const PageActions = ({ className, ...props }: PageActionsProps) => (
    <div 
        className={cn(
            'flex w-full items-center justify-start gap-2 py-2',
            className
        )}
        {...props}
    />
);

export { PageHeader, PageHeaderHeading, PageHeaderDescription, PageActions };