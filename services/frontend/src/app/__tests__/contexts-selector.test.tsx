import { render, screen, fireEvent } from '@testing-library/react';
import ContextsSelector from '@/components/ContextsSelector';
import type { Context } from '@/types/user';

jest.mock('@/i18n', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ContextsSelector', () => {
  const contexts: Context[] = [
    { id: '1', label: 'Au travail' },
    { id: '2', label: 'Famille' },
    { id: '3', label: 'Médical' },
  ];

  it('renders one button per context', () => {
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Au travail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Famille' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Médical' })).toBeInTheDocument();
  });

  it('calls onToggle with the context id when clicked', () => {
    const onToggle = jest.fn();
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Au travail' }));
    expect(onToggle).toHaveBeenCalledWith('1');
  });

  it('marks active contexts with aria-pressed="true"', () => {
    render(
      <ContextsSelector
        contexts={contexts}
        activeContextIds={new Set(['2'])}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Famille' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Au travail' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows empty hint when no contexts', () => {
    render(
      <ContextsSelector
        contexts={[]}
        activeContextIds={new Set()}
        onToggle={jest.fn()}
      />,
    );
    expect(
      screen.getByText('conversation.noContextsAdded'),
    ).toBeInTheDocument();
  });
});
