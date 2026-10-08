import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../components/Button';
import { RoleSwitcher } from '../components/RoleSwitcher';

describe('Button', () => {
  it('appelle onPress au toucher', async () => {
    const onPress = jest.fn();
    await render(<Button label="Créer mon compte" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ne réagit pas quand il est désactivé ou en chargement', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Payer" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button'));
    await rerender(<Button label="Payer" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('RoleSwitcher', () => {
  it('marque le rôle actif et signale le choix', async () => {
    const onSelect = jest.fn();
    await render(<RoleSwitcher active="PARTICIPANT" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Participant', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Organisateur' }));
    expect(onSelect).toHaveBeenCalledWith('ORGANIZER');
  });
});
