import 'react-table/react-table.css';

import React from 'react';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { IconButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';

import ReactTable from 'react-table';
import { isMobile } from 'react-device-detect';

import { SkillCell } from './SkillCell';
import { ActiveCrewDialog } from './ActiveCrewDialog';
import { RarityStars } from './RarityStars';
import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

export class CrewList extends React.Component {

	static defaultProps = {
		sortColumn: 'max_rarity',
	};

	constructor(props) {
		super(props);

		this.state = {
			items: props.data,
			sorted: [{ id: props.sortColumn, desc: false }],
			selection: props.selectedIds ? props.selectedIds : new Set()
		};

		this._showActiveDialog = this._showActiveDialog.bind(this);
		this._onRenderExpandedCard = this._onRenderExpandedCard.bind(this);
		this._onRenderCompactCard = this._onRenderCompactCard.bind(this);
		this._onSelectionChange = this._onSelectionChange.bind(this);
		this._isSelected = this._isSelected.bind(this);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.data !== this.state.items) {
			this.setState({ items: nextProps.data });
		}

		if (nextProps.selectedIds !== this.state.selection) {
			this.setState({ selection: nextProps.selectedIds ? nextProps.selectedIds : new Set() });
		}
	}

	_onSelectionChange(id, isChecked) {
		this.setState((prevState, props) => {
			let selection = prevState.selection;

			if (isChecked) {
				selection.add(id);
			} else {
				selection.delete(id);
			}

			if (props.onSelectionChange) {
				props.onSelectionChange(selection);
			}

			return { selection };
		});
	}

	_isSelected(id) {
		return this.state.selection && this.state.selection.has(id);
	}

	_onRenderCompactCard(item) {
		return <div className="ui items">
			<div className="item">
				<img src={item.iconBodyUrl} height={180} />
				<div className="content" style={{ padding: '12px' }}>
					<div className="header">{item.name}</div>
					<div className="meta">{item.flavor}</div>
					<div className="description">Traits: {item.traits.replace(new RegExp(',', 'g'), ', ')}</div>
				</div>
			</div>
		</div>;
	}

	_onRenderExpandedCard(item) {
		let equipment = [];
		item.equipment_slots.forEach(es => {
			equipment.push(
				{
					e: STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === es.archetype),
					have: es.have
				}
			);
		});

		let eqTable;
		if (equipment && equipment.length > 0) {
			eqTable = (<div>
				<h4 className="ui header">Equipment</h4>
				<table><tbody>
					<tr>
						{
							equipment.map((eq, ix) => {
								if (eq.e) {
									return (<td key={eq.e.name + ix}>
										<ItemDisplay src={eq.e.iconUrl} size={100} maxRarity={eq.e.rarity} rarity={eq.e.rarity} />
										<span style={{ fontSize: '0.8rem', color: eq.have ? "" : "red" }}>{eq.e.name}</span>
									</td>);
								}
								else {
									return <td></td>;
								}
							})
						}
					</tr></tbody>
				</table>
			</div>);
		}

		return (
			<div style={{ padding: '10px' }}>
				{eqTable}
				<h4 className="ui header">Ship abilitiy '{item.action.name}'</h4>
				<Label>Accuracy +{item.ship_battle.accuracy}  Crit Bonus +{item.ship_battle.crit_bonus}  {item.ship_battle.crit_chance && <span>Crit Rating +{item.ship_battle.crit_chance}  </span>}Evasion +{item.ship_battle.evasion}</Label>
				<Label>Increase {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.bonus_type]} by {item.action.bonus_amount}</Label>
				{item.action.penalty && <Label>Decrease {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.penalty.type]} by {item.action.penalty.amount}</Label>}

				{item.action.ability && <Label>Ability: {CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE[item.action.ability.type].replace('%VAL%', item.action.ability.amount)} {(item.action.ability.condition > 0) && <span>Trigger: {CONFIG.CREW_SHIP_BATTLE_TRIGGER[item.action.ability.condition]}</span>}</Label>}
				<Label>Duration: {item.action.duration}s  Cooldown: {item.action.cooldown}s  Initial Cooldown: {item.action.initial_cooldown}s  </Label>
				{item.action.limit && <Label>Limit: {item.action.limit} uses per battle</Label>}

				{this.renderChargePhases(item.action.charge_phases)}
			</div>
		);
	}

	renderChargePhases(charge_phases) {
		if (!charge_phases) {
			return <span />;
		} else {
			let phases = [];
			charge_phases.forEach((cp, idx) => {
				let phaseDescription = `Charge time: ${cp.charge_time}s`;

				if (cp.ability_amount) {
					phaseDescription += `  Ability amount: ${cp.ability_amount}`;
				}

				if (cp.bonus_amount) {
					phaseDescription += `  Bonus amount: ${cp.bonus_amount}`;
				}

				if (cp.duration) {
					phaseDescription += `  Duration: ${cp.duration}s`;
				}

				if (cp.cooldown) {
					phaseDescription += `  Cooldown: ${cp.cooldown}s`;
				}

				phases.push(<Label key={idx}>{phaseDescription}</Label>);
			});

			return (<div>
				<h4 className="ui header">Charge phases</h4>
				<div>
					{phases}
				</div>
			</div>);
		}
	}

	render() {
		let { items, sorted } = this.state;
		let pivotBy = [];

		if (this.props.groupRarity) {
			pivotBy = ['max_rarity'];
		}

		let columns = this._getColumns(this.props.duplicatelist, this.props.showBuyback, this.props.compactMode, pivotBy.length > 0);

		const defaultButton = props => <DefaultButton {...props} text={props.children} style={{ width: '100%' }} />;

		return (
			<div className={this.props.embedded ? 'embedded-crew-grid' : 'data-grid'} data-is-scrollable='true'>
				<ReactTable
					data={items}
					columns={columns}
					defaultPageSize={(items.length <= 50) ? items.length : 50}
					pageSize={(items.length <= 50) ? items.length : 50}
					sorted={sorted}
					onSortedChange={sorted => this.setState({ sorted })}
					showPagination={(items.length > 50)}
					showPageSizeOptions={false}
					className="-striped -highlight"
					NextComponent={defaultButton}
					PreviousComponent={defaultButton}
					style={(!this.props.embedded && (items.length > 50)) ? { height: 'calc(100vh - 88px)' } : {}}
					pivotBy={pivotBy}
					getTrProps={(s, r) => {
						return {
							style: {
								opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
							}
						};
					}}
					getTdProps={(s, r) => {
						return this.props.compactMode ? { style: { padding: "2px 3px" } } : {};
					}}
				/>
				<ActiveCrewDialog ref='activeCrewDialog' />
			</div>
		);
	}

	_getColumns(duplicatelist, showBuyBack, compactMode, pivotRarity) {
		let _columns = [];

		if (duplicatelist) {
			_columns.push({
				id: 'airlock',
				Header: 'Airlock',
				minWidth: 100,
				maxWidth: 100,
				resizable: false,
				style: { marginTop: 15 },
				Cell: (p) => {
					let crew = p.original;

					if (crew.crew_id)
						return (<Checkbox label='Airlock'
							checked={this._isSelected(crew.crew_id)}
							onChange={(ev, isChecked) => this._onSelectionChange(crew.crew_id, isChecked)} />);
					else
						return <span />;
				}
			});
		}

		if (pivotRarity) {
			_columns.push({
				id: 'max_rarity',
				Header: 'Rarity',
				accessor: (c) => CONFIG.RARITIES[c.max_rarity].name,
				minWidth: 150,
				maxWidth: 150,
				resizable: false,
				Cell: (cell) => <span />
			});
		}

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: compactMode ? 28 : 60,
			maxWidth: compactMode ? 28 : 60,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={cell.original.iconUrl} width={compactMode ? 22 : 50} height={compactMode ? 22 : 50} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
			Aggregated: row => <span />
		});

		if (!isMobile) {
			_columns.push({
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <a href={'https://sttwiki.org/wiki/' + cell.original.name.split(' ').join('_')} target='_blank'>{cell.original.short_name}</a>;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <HoverCard id="nameHoverCard"
							expandingCardProps={{
								compactCardHeight: 180,
								expandedCardHeight: 420,
								renderData: cell.original,
								onRenderExpandedCard: this._onRenderExpandedCard,
								onRenderCompactCard: this._onRenderCompactCard,
								styles: { root: { width: '520px' } }
							}}
							instantOpenOnClick={true}>
							<span>{cell.original.name}</span>
						</HoverCard>;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)}</span>
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				// Sort all by max fusion level, then fractional part by current fusion level
				accessor: (c) => c.max_rarity + (c.rarity / c.max_rarity),
				minWidth: 75,
				maxWidth: 85,
				resizable: false,
				Cell: (cell) => {
					if (cell && cell.original) {
						return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			});

		if (!isMobile) {
			_columns.push({
				id: 'favorite',
				Header: () => <Icon iconName='FavoriteStar' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'favorite',
				Cell: (cell) => {
					if (cell && cell.original && cell.value) {
						return <TooltipHost content={`You marked ${cell.original.short_name} as favorite in the game`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='FavoriteStar' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			},
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			});
		}

		// TODO: add global setting / toggle for turning off buy-back crew
		if (!duplicatelist && showBuyBack) {
			_columns.push({
				id: 'buyback',
				Header: () => <Icon iconName='EmptyRecycleBin' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'buyback',
				Cell: (cell) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`This copy of ${cell.original.short_name} was dismissed and is available for buyback for a limited time`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='EmptyRecycleBin' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			});
		}

		if (!compactMode && !isMobile) {
			_columns.push({
				id: 'active_id',
				Header: () => <Icon iconName='Balloons' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'active_id',
				Cell: (cell) => {
					if (cell && cell.original && cell.original.active_id) {
						return <IconButton iconProps={{ iconName: 'Balloons' }} title='Active engagement' onClick={() => this._showActiveDialog(cell.original.active_id, cell.original.name)} />;
					} else {
						return <span />;
					}
				},
				Aggregated: row => <span />
			});
		}

		_columns.push({
			id: 'command_skill',
			Header: 'Command',
			minWidth: 70,
			maxWidth: 100,
			resizable: true,
			accessor: 'command_skill_core',
			Cell: (cell) => cell.original ? <SkillCell skill={cell.original.command_skill} compactMode={compactMode} /> : <span />,
			aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
			Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
		},
			{
				id: 'diplomacy_skill',
				Header: 'Diplomacy',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: 'diplomacy_skill_core',
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.diplomacy_skill} compactMode={compactMode} /> : <span />,
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				id: 'engineering_skill',
				Header: 'Engineering',
				minWidth: 75,
				maxWidth: 100,
				resizable: true,
				accessor: 'engineering_skill_core',
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.engineering_skill} compactMode={compactMode} /> : <span />,
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				id: 'medicine_skill',
				Header: 'Medicine',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: 'medicine_skill_core',
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.medicine_skill} compactMode={compactMode} /> : <span />,
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				id: 'science_skill',
				Header: 'Science',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: 'science_skill_core',
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.science_skill} compactMode={compactMode} /> : <span />,
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				id: 'security_skill',
				Header: 'Security',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: 'security_skill_core',
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.security_skill} compactMode={compactMode} /> : <span />,
				aggregate: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
				Aggregated: row => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				key: 'traits',
				Header: 'Traits',
				minWidth: 140,
				isResizable: true,
				accessor: 'traits',
				Cell: (cell) => cell.original ? <div style={compactMode ? { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } : { whiteSpace: 'normal', height: '50px' }}>{cell.original.traits.replace(/,/g, ', ')}</div> : <span />,
				aggregate: vals => 0,
				Aggregated: row => <span />
			});

		return _columns;
	}

	_filterCrew(crew, searchString) {
		return searchString.split(' ').every(text => {
			// search the name first
			if (crew.name.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the traits
			if (crew.traits.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the raw traits
			if (crew.rawTraits.find(trait => { trait.toLowerCase().indexOf(text) > -1 })) {
				return true;
			}

			return false;
		});
	}

	filter(newValue) {
		this.setState({
			items: (newValue ?
				this.props.data.filter(i => this._filterCrew(i, newValue.toLowerCase())) :
				this.props.data)
		});
	}

	_showActiveDialog(active_id, name) {
		this.refs.activeCrewDialog.show(active_id, name);
	}
}
