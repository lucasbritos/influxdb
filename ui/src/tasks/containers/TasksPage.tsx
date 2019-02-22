// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {InjectedRouter} from 'react-router'

// Components
import TasksHeader from 'src/tasks/components/TasksHeader'
import TasksList from 'src/tasks/components/TasksList'
import {Page} from 'src/pageLayout'
import {ErrorHandling} from 'src/shared/decorators/errors'
import ImportOverlay from 'src/shared/components/ImportOverlay'
import FilterList from 'src/shared/components/Filter'

// Actions
import {
  populateTasks,
  updateTaskStatus,
  deleteTask,
  selectTask,
  cloneTask,
  setSearchTerm as setSearchTermAction,
  setShowInactive as setShowInactiveAction,
  setDropdownOrgID as setDropdownOrgIDAction,
  importTask,
  addTaskLabelsAsync,
  removeTaskLabelsAsync,
  runTask,
} from 'src/tasks/actions/v2'

// Constants
import {allOrganizationsID} from 'src/tasks/constants'

// Types
import {Task as TaskAPI, User, Organization} from '@influxdata/influx'
import {AppState} from 'src/types/v2'

export interface Task extends TaskAPI {
  organization: Organization
  owner?: User
  offset?: string
}

interface PassedInProps {
  router: InjectedRouter
}

interface ConnectedDispatchProps {
  populateTasks: typeof populateTasks
  updateTaskStatus: typeof updateTaskStatus
  deleteTask: typeof deleteTask
  cloneTask: typeof cloneTask
  selectTask: typeof selectTask
  setSearchTerm: typeof setSearchTermAction
  setShowInactive: typeof setShowInactiveAction
  setDropdownOrgID: typeof setDropdownOrgIDAction
  importTask: typeof importTask
  onAddTaskLabels: typeof addTaskLabelsAsync
  onRemoveTaskLabels: typeof removeTaskLabelsAsync
  onRunTask: typeof runTask
}

interface ConnectedStateProps {
  tasks: Task[]
  searchTerm: string
  showInactive: boolean
  orgs: Organization[]
  dropdownOrgID: string
}

type Props = ConnectedDispatchProps & PassedInProps & ConnectedStateProps

interface State {
  isImporting: boolean
  taskLabelsEdit: Task
}

@ErrorHandling
class TasksPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    props.setSearchTerm('')
    if (!props.showInactive) {
      props.setShowInactive()
    }
    props.setDropdownOrgID(null)

    this.state = {
      isImporting: false,
      taskLabelsEdit: null,
    }
  }

  public render(): JSX.Element {
    const {
      setSearchTerm,
      searchTerm,
      setShowInactive,
      showInactive,
      onAddTaskLabels,
      onRemoveTaskLabels,
      onRunTask,
    } = this.props

    return (
      <>
        <Page titleTag="Tasks">
          <TasksHeader
            onCreateTask={this.handleCreateTask}
            setSearchTerm={setSearchTerm}
            setShowInactive={setShowInactive}
            showInactive={showInactive}
            toggleOverlay={this.handleToggleImportOverlay}
            searchTerm={searchTerm}
          />
          <Page.Contents fullWidth={false} scrollable={true}>
            <div className="col-xs-12">
              <FilterList<Task>
                list={this.filteredTasks}
                searchTerm={searchTerm}
                searchKeys={['name', 'labels[].name']}
              >
                {ts => (
                  <TasksList
                    searchTerm={searchTerm}
                    tasks={ts}
                    totalCount={this.totalTaskCount}
                    onActivate={this.handleActivate}
                    onDelete={this.handleDelete}
                    onCreate={this.handleCreateTask}
                    onClone={this.handleClone}
                    onSelect={this.props.selectTask}
                    onAddTaskLabels={onAddTaskLabels}
                    onRemoveTaskLabels={onRemoveTaskLabels}
                    onRunTask={onRunTask}
                    onFilterChange={setSearchTerm}
                  />
                )}
              </FilterList>
              {this.hiddenTaskAlert}
            </div>
          </Page.Contents>
        </Page>
        {this.importOverlay}
      </>
    )
  }

  public componentDidMount() {
    this.props.populateTasks()
  }

  private handleActivate = (task: Task) => {
    this.props.updateTaskStatus(task)
  }

  private handleDelete = (task: Task) => {
    this.props.deleteTask(task)
  }

  private handleClone = (task: Task) => {
    const {tasks} = this.props
    this.props.cloneTask(task, tasks)
  }

  private handleCreateTask = () => {
    const {router} = this.props

    router.push('/tasks/new')
  }

  private handleToggleImportOverlay = (): void => {
    this.setState({isImporting: !this.state.isImporting})
  }

  private get importOverlay(): JSX.Element {
    const {isImporting} = this.state
    const {importTask} = this.props

    return (
      <ImportOverlay
        isVisible={isImporting}
        resourceName="Task"
        onDismissOverlay={this.handleToggleImportOverlay}
        onImport={importTask}
        isResourceValid={this.handleValidateTask}
      />
    )
  }

  private handleValidateTask = (): boolean => {
    return true
  }

  private get filteredTasks(): Task[] {
    const {tasks, showInactive, dropdownOrgID} = this.props
    const matchingTasks = tasks.filter(t => {
      let activeFilter = true
      if (!showInactive) {
        activeFilter = t.status === TaskAPI.StatusEnum.Active
      }
      let orgIDFilter = true
      if (dropdownOrgID && dropdownOrgID !== allOrganizationsID) {
        orgIDFilter = t.orgID === dropdownOrgID
      }
      return activeFilter && orgIDFilter
    })

    return matchingTasks
  }

  private get totalTaskCount(): number {
    return this.props.tasks.length
  }

  private get hiddenTaskAlert(): JSX.Element {
    const {showInactive, tasks} = this.props

    const hiddenCount = tasks.filter(
      t => t.status === TaskAPI.StatusEnum.Inactive
    ).length

    const allTasksAreHidden = hiddenCount === tasks.length

    if (allTasksAreHidden || showInactive) {
      return null
    }

    if (hiddenCount) {
      const pluralizer = hiddenCount === 1 ? '' : 's'
      const verb = hiddenCount === 1 ? 'is' : 'are'

      return (
        <div className="hidden-tasks-alert">{`${hiddenCount} inactive task${pluralizer} ${verb} hidden from view`}</div>
      )
    }
  }
}

const mstp = ({
  tasks: {tasks, searchTerm, showInactive, dropdownOrgID},
  orgs,
}: AppState): ConnectedStateProps => {
  return {
    tasks,
    searchTerm,
    showInactive,
    orgs,
    dropdownOrgID,
  }
}

const mdtp: ConnectedDispatchProps = {
  populateTasks,
  updateTaskStatus,
  deleteTask,
  selectTask,
  cloneTask,
  setSearchTerm: setSearchTermAction,
  setShowInactive: setShowInactiveAction,
  setDropdownOrgID: setDropdownOrgIDAction,
  importTask,
  onRemoveTaskLabels: removeTaskLabelsAsync,
  onAddTaskLabels: addTaskLabelsAsync,
  onRunTask: runTask,
}

export default connect<
  ConnectedStateProps,
  ConnectedDispatchProps,
  PassedInProps
>(
  mstp,
  mdtp
)(TasksPage)
