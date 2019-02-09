package epoch

import (
	"sync"

	"github.com/influxdata/influxdb/models"
)

// Matcher allows one to check if it matches a set of points and to
// wait on it until someone calls Done.
type Matcher interface {
	Matches([]models.Point) bool
	Wait()
	Done()
}

// Tracker keeps track of epochs for write and delete operations
// allowing a delete to block until all previous writes have completed.
type Tracker struct {
	mu      sync.Mutex
	epoch   uint64 // current epoch
	largest uint64 // largest delete possible
	writes  int64  // pending writes
	// pending deletes waiting on writes
	deletes map[uint64]*deleteState
}

// NewTracker constructs a Tracker.
func NewTracker() *Tracker {
	return &Tracker{
		deletes: make(map[uint64]*deleteState),
	}
}

// deleteState keeps track of the state for a pending delete.
type deleteState struct {
	cond    *sync.Cond
	matcher Matcher
	pending int64
}

// done signals that an earlier write has finished.
func (e *deleteState) done() {
	e.cond.L.Lock()
	e.pending--
	if e.pending == 0 {
		e.cond.Broadcast()
	}
	e.cond.L.Unlock()
}

// Wait blocks until all earlier writes have finished.
func (e *deleteState) Wait() {
	e.cond.L.Lock()
	for e.pending > 0 {
		e.cond.Wait()
	}
	e.cond.L.Unlock()
}

// next bumps the epoch and returns it.
func (e *Tracker) next() uint64 {
	e.epoch++
	return e.epoch
}

// StartWrite should be called before a write is going to start.
func (e *Tracker) StartWrite() ([]Matcher, uint64) {
	e.mu.Lock()
	gen := e.next()
	e.writes++

	if len(e.deletes) == 0 {
		e.mu.Unlock()
		return nil, gen
	}

	matchers := make([]Matcher, 0, len(e.deletes))
	for _, state := range e.deletes {
		matchers = append(matchers, state.matcher)
	}

	e.mu.Unlock()
	return matchers, gen
}

// EndWrite should be called when the write ends for any reason.
func (e *Tracker) EndWrite(gen uint64) {
	e.mu.Lock()
	if gen <= e.largest {
		// TODO(jeff): at the cost of making waitDelete more
		// complicated, we can keep a sorted slice which would
		// allow this to exit early rather than go over the
		// whole map.
		for dgen, state := range e.deletes {
			if gen > dgen {
				continue
			}
			state.done()
		}
	}
	e.writes--
	e.mu.Unlock()
}

// Waiter is a type that can be waited on for prior writes to finish.
type Waiter struct {
	gen     uint64
	matcher Matcher
	state   *deleteState
	tracker *Tracker
}

// Wait blocks until all writes prior to the creation of the waiter finish.
func (e Waiter) Wait() {
	if e.state == nil || e.tracker == nil {
		return
	}
	e.state.Wait()
}

// Done marks the delete as completed, removing its guard.
func (e Waiter) Done() {
	e.tracker.mu.Lock()
	delete(e.tracker.deletes, e.gen)
	e.tracker.mu.Unlock()
	e.matcher.Done()
}

// WaitDelete returns a Waiter that can be used to wait until all previous writes
// have completed. It prevents any new writes whos points match the provided guard.
func (e *Tracker) WaitDelete(matcher Matcher) Waiter {
	e.mu.Lock()
	state := &deleteState{
		pending: e.writes,
		cond:    sync.NewCond(new(sync.Mutex)),
		matcher: matcher,
	}

	// record our pending delete
	gen := e.next()
	e.largest = gen
	e.deletes[gen] = state
	e.mu.Unlock()

	return Waiter{
		gen:     gen,
		matcher: matcher,
		state:   state,
		tracker: e,
	}
}
