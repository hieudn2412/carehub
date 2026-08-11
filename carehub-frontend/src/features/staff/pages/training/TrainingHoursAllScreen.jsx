import TrainingHoursListScreen from './TrainingHoursListScreen.jsx'

/**
 * Full training-hours list route.
 *
 * The table implementation remains in TrainingHoursListScreen for now so the
 * Phase 1 table extraction can be reused without changing its data-loading
 * behavior. Keeping this route component separate makes the URL contract
 * explicit and leaves the overview screen free to evolve independently.
 */
function TrainingHoursAllScreen() {
  return <TrainingHoursListScreen />
}

export default TrainingHoursAllScreen
