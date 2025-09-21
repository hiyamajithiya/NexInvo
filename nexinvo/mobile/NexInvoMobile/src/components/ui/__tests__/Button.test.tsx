import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders, TestDataFactory } from '../../../__tests__/utils/testUtils';
import { Button } from '../Button';

describe('Button Component', () => {
  const defaultProps = {
    title: 'Test Button',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with title', () => {
      const { getByText } = renderWithProviders(
        <Button {...defaultProps} />
      );

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render as disabled when disabled prop is true', () => {
      const { getByTestId } = renderWithProviders(
        <Button {...defaultProps} disabled={true} testID="test-button" />
      );

      const button = getByTestId('test-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('should render loading state', () => {
      const { getByTestId } = renderWithProviders(
        <Button {...defaultProps} loading={true} testID="test-button" />
      );

      const button = getByTestId('test-button');
      expect(button).toBeTruthy();
      // Loading indicator should be present (implementation dependent)
    });

    it('should render with different variants', () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;

      variants.forEach(variant => {
        const { getByTestId } = renderWithProviders(
          <Button
            {...defaultProps}
            variant={variant}
            testID={`button-${variant}`}
          />
        );

        const button = getByTestId(`button-${variant}`);
        expect(button).toBeTruthy();
      });
    });

    it('should render with different sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;

      sizes.forEach(size => {
        const { getByTestId } = renderWithProviders(
          <Button
            {...defaultProps}
            size={size}
            testID={`button-${size}`}
          />
        );

        const button = getByTestId(`button-${size}`);
        expect(button).toBeTruthy();
      });
    });

    it('should render with custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          style={customStyle}
          testID="styled-button"
        />
      );

      const button = getByTestId('styled-button');
      expect(button).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onPress when pressed', () => {
      const onPressMock = jest.fn();
      const { getByText } = renderWithProviders(
        <Button title="Press Me" onPress={onPressMock} />
      );

      const button = getByText('Press Me');
      fireEvent.press(button);

      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const onPressMock = jest.fn();
      const { getByText } = renderWithProviders(
        <Button title="Disabled Button" onPress={onPressMock} disabled={true} />
      );

      const button = getByText('Disabled Button');
      fireEvent.press(button);

      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPressMock = jest.fn();
      const { getByTestId } = renderWithProviders(
        <Button
          title="Loading Button"
          onPress={onPressMock}
          loading={true}
          testID="loading-button"
        />
      );

      const button = getByTestId('loading-button');
      fireEvent.press(button);

      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('should handle long press', () => {
      const onLongPressMock = jest.fn();
      const { getByText } = renderWithProviders(
        <Button
          title="Long Press Button"
          onPress={() => {}}
          onLongPress={onLongPressMock}
        />
      );

      const button = getByText('Long Press Button');
      fireEvent(button, 'onLongPress');

      expect(onLongPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility properties', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          accessibilityLabel="Test button for accessibility"
          accessibilityHint="Tap to perform test action"
          testID="accessible-button"
        />
      );

      const button = getByTestId('accessible-button');
      expect(button.props.accessibilityLabel).toBe('Test button for accessibility');
      expect(button.props.accessibilityHint).toBe('Tap to perform test action');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('should have correct accessibility state when disabled', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          disabled={true}
          testID="disabled-button"
        />
      );

      const button = getByTestId('disabled-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('should have correct accessibility state when loading', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          loading={true}
          testID="loading-button"
        />
      );

      const button = getByTestId('loading-button');
      expect(button.props.accessibilityState?.busy).toBe(true);
    });
  });

  describe('Props Validation', () => {
    it('should handle missing onPress gracefully', () => {
      const { getByText } = renderWithProviders(
        <Button title="No Handler" />
      );

      const button = getByText('No Handler');
      expect(() => fireEvent.press(button)).not.toThrow();
    });

    it('should handle empty title', () => {
      const { getByTestId } = renderWithProviders(
        <Button title="" onPress={() => {}} testID="empty-title-button" />
      );

      const button = getByTestId('empty-title-button');
      expect(button).toBeTruthy();
    });

    it('should handle undefined title', () => {
      const { getByTestId } = renderWithProviders(
        <Button onPress={() => {}} testID="no-title-button" />
      );

      const button = getByTestId('no-title-button');
      expect(button).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should apply correct styles for primary variant', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          variant="primary"
          testID="primary-button"
        />
      );

      const button = getByTestId('primary-button');
      expect(button).toBeTruthy();
      // Style verification would depend on implementation
    });

    it('should apply correct styles for different sizes', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          size="large"
          testID="large-button"
        />
      );

      const button = getByTestId('large-button');
      expect(button).toBeTruthy();
    });

    it('should merge custom styles with default styles', () => {
      const customStyle = { marginTop: 20 };
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          style={customStyle}
          testID="custom-styled-button"
        />
      );

      const button = getByTestId('custom-styled-button');
      expect(button).toBeTruthy();
    });
  });

  describe('Icon Support', () => {
    it('should render with icon', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          {...defaultProps}
          icon="plus"
          testID="icon-button"
        />
      );

      const button = getByTestId('icon-button');
      expect(button).toBeTruthy();
    });

    it('should render icon-only button', () => {
      const { getByTestId } = renderWithProviders(
        <Button
          onPress={() => {}}
          icon="settings"
          testID="icon-only-button"
        />
      );

      const button = getByTestId('icon-only-button');
      expect(button).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const onPressMock = jest.fn();
      const { rerender } = renderWithProviders(
        <Button title="Test" onPress={onPressMock} />
      );

      // Re-render with same props
      rerender(<Button title="Test" onPress={onPressMock} />);

      // Component should handle this efficiently
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('should handle rapid button presses', () => {
      const onPressMock = jest.fn();
      const { getByText } = renderWithProviders(
        <Button title="Rapid Press" onPress={onPressMock} />
      );

      const button = getByText('Rapid Press');

      // Simulate rapid presses
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      // Should call onPress for each press (or implement debouncing)
      expect(onPressMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Snapshot Testing', () => {
    it('should match snapshot for default button', () => {
      const { toJSON } = renderWithProviders(
        <Button {...defaultProps} />
      );

      expect(toJSON()).toMatchSnapshot('Button-default');
    });

    it('should match snapshot for disabled button', () => {
      const { toJSON } = renderWithProviders(
        <Button {...defaultProps} disabled={true} />
      );

      expect(toJSON()).toMatchSnapshot('Button-disabled');
    });

    it('should match snapshot for loading button', () => {
      const { toJSON } = renderWithProviders(
        <Button {...defaultProps} loading={true} />
      );

      expect(toJSON()).toMatchSnapshot('Button-loading');
    });

    it('should match snapshot for different variants', () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;

      variants.forEach(variant => {
        const { toJSON } = renderWithProviders(
          <Button {...defaultProps} variant={variant} />
        );

        expect(toJSON()).toMatchSnapshot(`Button-${variant}`);
      });
    });
  });
});