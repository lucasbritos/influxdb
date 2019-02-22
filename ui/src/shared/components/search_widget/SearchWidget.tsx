// Libraries
import React, {Component, ChangeEvent} from 'react'
import _ from 'lodash'

// Components
import {IconFont, Input} from 'src/clockface'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onSearch: (searchTerm: string) => void
  widthPixels?: number
  placeholderText?: string
  searchTerm: string
}

interface State {
  searchTerm: string
}

@ErrorHandling
class SearchWidget extends Component<Props, State> {
  public static defaultProps: Partial<Props> = {
    widthPixels: 210,
    placeholderText: 'Search...',
    searchTerm: '',
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.props.searchTerm !== prevProps.searchTerm) {
      this.setState({searchTerm: this.props.searchTerm})
    }
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: this.props.searchTerm,
    }
  }

  public componentWillMount() {
    this.handleSearch = _.debounce(this.handleSearch, 50)
  }

  public render() {
    const {placeholderText, widthPixels} = this.props
    const {searchTerm} = this.state

    return (
      <Input
        icon={IconFont.Search}
        placeholder={placeholderText}
        widthPixels={widthPixels}
        value={searchTerm}
        onChange={this.handleChange}
        onBlur={this.handleBlur}
        testID={`search-widget ${searchTerm}`}
      />
    )
  }

  private handleSearch = (): void => {
    this.props.onSearch(this.state.searchTerm)
  }

  private handleBlur = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({searchTerm: e.target.value}, this.handleSearch)
  }

  private handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({searchTerm: e.target.value}, this.handleSearch)
  }
}

export default SearchWidget
