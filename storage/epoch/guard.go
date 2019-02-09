package epoch

import (
	"sync"

	"github.com/influxdata/influxdb/models"
)

// TODO(jeff): figure out the appropriate things to guard on.

// Guard lets one match a set of points and block until they are done.
type Guard struct {
	cond *sync.Cond
	done bool
}

// NewGuard constructs a Guard that matches nothing.
func NewGuard() *Guard {
	return &Guard{
		cond: sync.NewCond(new(sync.Mutex)),
	}
}

// Matches returns true if any of the points match the Guard.
func (g *Guard) Matches(points []models.Point) bool {
	return g == nil
}

// Wait blocks until the Guard has been marked Done.
func (g *Guard) Wait() {
	g.cond.L.Lock()
	for !g.done {
		g.cond.Wait()
	}
	g.cond.L.Unlock()
}

// Done signals to anyone waiting on the Guard that they can proceed.
func (g *Guard) Done() {
	g.cond.L.Lock()
	g.done = true
	g.cond.Broadcast()
	g.cond.L.Unlock()
}
