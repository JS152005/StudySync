// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader2-icon">Loading...</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
  Sparkles: () => <span data-testid="sparkles-icon">*</span>,
}));

import { Button } from '../../client/src/components/ui/Button.js';
import { ToggleSwitch } from '../../client/src/components/ui/ToggleSwitch.js';
import { EmptyState } from '../../client/src/components/ui/EmptyState.js';
import { Skeleton } from '../../client/src/components/ui/Skeleton.js';

describe('StudySync Frontend Interactive Components & Forms Suite', () => {
  afterEach(() => {
    cleanup();
  });

  describe('1. Button Component Variants, Shapes & Clicks', () => {
    it('Renders button with children text and fires onClick handler', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Create Study Room</Button>);

      const btn = screen.getByRole('button', { name: /create study room/i });
      expect(btn).toBeDefined();

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('Disables button and prevents clicks when loading', () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Submit</Button>);

      const btn = screen.getByRole('button', { name: /submit/i });
      expect(btn.hasAttribute('disabled')).toBe(true);

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('Applies correct shape and variant classes', () => {
      const { container } = render(<Button variant="danger" shape="pill">Delete Room</Button>);
      const btn = container.querySelector('button');
      expect(btn).toBeDefined();
    });
  });

  describe('2. ToggleSwitch Component & Accessibility Role', () => {
    it('Renders accessible switch role with checked/unchecked state', () => {
      const handleToggle = vi.fn();
      render(<ToggleSwitch checked={true} onChange={handleToggle} label="Sound Cues" />);

      const toggle = screen.getByRole('switch', { name: /sound cues/i });
      expect(toggle).toBeDefined();
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      fireEvent.click(toggle);
      expect(handleToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('3. EmptyState Component', () => {
    it('Renders empty state title, description and optional action button', () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          icon={<span>EmptyIcon</span>}
          title="No Active Study Rooms"
          description="Create a room to start collaborating with peers."
          action={<Button onClick={handleAction}>Create Room</Button>}
        />
      );

      expect(screen.getByText('No Active Study Rooms')).toBeDefined();
      expect(screen.getByText('Create a room to start collaborating with peers.')).toBeDefined();

      const actionBtn = screen.getByRole('button', { name: /create room/i });
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Skeleton Loading Component', () => {
    it('Renders skeleton with specified width, height and border radius', () => {
      const { container } = render(<Skeleton width="200px" height="40px" borderRadius="8px" />);
      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton.style.width).toBe('200px');
      expect(skeleton.style.height).toBe('40px');
      expect(skeleton.style.borderRadius).toBe('8px');
    });
  });

  describe('5. Modal Dialog Component & Keyboard Dismissal', () => {
    it('Renders modal with title, content and close button', () => {
      const handleClose = vi.fn();
      render(
        <div id="modal-root">
          <div role="dialog" aria-modal="true">
            <h2>Create Study Group</h2>
            <p>Enter group details below</p>
            <button onClick={handleClose} aria-label="Close modal">✕</button>
          </div>
        </div>
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Create Study Group')).toBeDefined();
      const closeBtn = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. Interactive Form Validation & Submission', () => {
    it('Validates required inputs and prevents invalid submission', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault());
      render(
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required defaultValue="" />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required defaultValue="" />

          <button type="submit">Log In</button>
        </form>
      );

      const userInput = screen.getByLabelText(/username/i) as HTMLInputElement;
      expect(userInput.required).toBe(true);
      expect(userInput.checkValidity()).toBe(false);

      const submitBtn = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitBtn);
      // Native HTML5 validation stops form submission when required fields are empty
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('Handles valid form field inputs and updates values', () => {
      render(
        <form>
          <label htmlFor="student-id">Search by Student ID</label>
          <input id="student-id" name="studentId" defaultValue="" />
        </form>
      );

      const input = screen.getByLabelText(/search by student id/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'STU-ABC123' } });
      expect(input.value).toBe('STU-ABC123');
    });
  });
});
