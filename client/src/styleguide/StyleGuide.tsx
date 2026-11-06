import { useState } from 'react';
import { ActionButtons } from '../ui/ActionButtons.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { Field, Input } from '../ui/Input.js';
import { Modal } from '../ui/Modal.js';
import { SeatPanel } from '../ui/SeatPanel.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { Toast } from '../ui/Toast.js';
import { TileBack, TileFace } from '../components/Tile.js';

const SWATCHES: Array<[string, string]> = [
  ['Room', 'var(--room)'],
  ['Surface', 'var(--surface)'],
  ['Text', 'var(--text)'],
  ['Muted', 'var(--text-muted)'],
  ['Accent', 'var(--accent)'],
  ['Danger', 'var(--danger)'],
  ['Success', 'var(--success)'],
  ['Felt', 'var(--table-felt)'],
  ['East', 'var(--seat-east)'],
  ['South', 'var(--seat-south)'],
  ['West', 'var(--seat-west)'],
  ['North', 'var(--seat-north)'],
];

function Swatches() {
  return (
    <div className="sg-swatches">
      {SWATCHES.map(([name, color]) => (
        <div key={name} className="sg-swatch">
          <span className="sg-chip" style={{ background: color }} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

const HAND = [0, 4, 8, 9, 13, 18, 22, 26, 27, 28, 31, 32, 33, 34, 38];

export function StyleGuide() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);

  return (
    <main className="styleguide">
      <header className="sg-block">
        <p className="eyebrow">Design system</p>
        <h1 className="display">Table tokens</h1>
        <p className="sg-note">
          Ivory tiles, one brass accent, a green felt that does not flip with the room.
          Everything on this page is a real component.
        </p>
        <div className="sg-row">
          <ThemeToggle />
          <a href="#">Back to the game</a>
        </div>
      </header>

      <section className="sg-block">
        <h2>Color</h2>
        <div className="theme-pair">
          <div className="sg-frame" data-theme="dark">
            <h3>Dark room</h3>
            <Swatches />
          </div>
          <div className="sg-frame" data-theme="light">
            <h3>Light room</h3>
            <Swatches />
          </div>
        </div>
      </section>

      <section className="sg-block">
        <h2>Type</h2>
        <p className="display">Display</p>
        <p className="text-xl">Title</p>
        <p className="text-lg">Section</p>
        <p>Body. Sixteen tiles, five sets and a pair.</p>
        <p className="text-sm muted">Muted helper</p>
      </section>

      <section className="sg-block">
        <h2>Buttons</h2>
        <div className="sg-row">
          <Button variant="primary">Create a table</Button>
          <Button variant="secondary">Join</Button>
          <Button variant="ghost">Got it</Button>
          <Button variant="danger">Exit game</Button>
          <Button variant="primary" disabled>
            Need 3 more
          </Button>
        </div>
        <div className="sg-row">
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="md" variant="secondary">Medium</Button>
          <Button size="lg" variant="secondary">Large</Button>
        </div>
      </section>

      <section className="sg-block">
        <h2>Tiles</h2>
        <div className="sg-row">
          {HAND.map((tile) => (
            <TileFace key={tile} tile={tile} size="hand" />
          ))}
        </div>
        <div className="sg-row">
          <TileFace tile={8} size="hand" justDrawn highlight />
          <TileFace tile={13} size="discard" claimable highlight />
          <TileFace tile={22} size="meld" />
          <TileFace tile={27} size="hand" selected />
          <TileFace tile={31} size="hand" dim disabled />
          <TileBack size="hand" />
          <TileBack size="discard" />
        </div>
        <p className="sg-note">Hand, just drawn, claimable discard, meld, selected, disabled, backs.</p>
      </section>

      <section className="sg-block">
        <h2>Seats</h2>
        <div className="sg-row">
          <SeatPanel pos="south" name="Elliot" wind={0} score={120} self dealer current />
          <SeatPanel pos="east" name="Ah-Ming" wind={1} score={-20} bot />
          <SeatPanel pos="north" name="Hsiao-Yu" wind={2} score={0} away passedWater />
          <SeatPanel pos="west" name="Chen" wind={3} score={40} thinking />
        </div>
      </section>

      <section className="sg-block">
        <h2>Claims</h2>
        <ActionButtons
          showTiles
          actions={[
            { id: 'win', type: 'win', label: 'Win on 9 Bamboo — 4 tai', taiPreview: 4 },
            { id: 'pung', type: 'pung', tile: 8, label: 'Pong 9s' },
            { id: 'chow', type: 'chow', tile: 8, chowLow: 6, label: 'Chi 7-8-9s' },
            { id: 'pass', type: 'pass', label: 'Pass' },
          ]}
          onAct={() => {}}
        />
        <div className="sg-row">
          <Badge>bot</Badge>
          <Badge tone="danger">莊</Badge>
          <Badge tone="warning">away</Badge>
          <Badge tone="accent">thinking…</Badge>
          <Badge tone="success">+30</Badge>
        </div>
      </section>

      <section className="sg-block">
        <h2>Input, card, toast, sheet</h2>
        <Card title="Table rules">
          <Field label="Your name" hint="Shown to the other three seats.">
            <Input placeholder="Elliot" />
          </Field>
          <div className="sg-row">
            <Button variant="secondary" onClick={() => setToast(true)}>
              Show an error
            </Button>
            <Button variant="primary" onClick={() => setOpen(true)}>
              Open a sheet
            </Button>
          </div>
        </Card>
        {toast && <Toast>That table code was not found.</Toast>}
      </section>

      {open && (
        <Modal title="Exit this table?" sheet narrow>
          <p className="confirm-rule">You will leave the room. The code still works if the table is open.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Stay
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Exit game
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
