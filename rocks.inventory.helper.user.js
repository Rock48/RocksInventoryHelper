// ==UserScript==
// @name         Rock's Inventory Helper
// @namespace    https://moonlightsoftware.net/
// @version      0.6.0
// @description  Q - Open instant sell dialog
// @description  L - Open list at lowest price dialog
// @description  A - Confirm the current open sell dialog
// @description  Shift+[Q/L] - Instant/List and immediately accept and close sell dialog
// @author       Charles "Rock48" Quigley
// @match        https://steamcommunity.com/id/*/inventory*
// @match        https://steamcommunity.com/profiles/*/inventory*
// @updateURL	 https://github.com/Rock48/RocksInventoryHelper/raw/master/rocks.inventory.helper.user.js
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	if(g_ActiveInventory.m_steamid != g_steamID) return;

	let sheet = (() => {
		var style = document.createElement("style");
		style.appendChild(document.createTextNode(""));
		document.head.appendChild(style);
		return style.sheet;
	})();
	
	sheet.addRule(".selected-for-sale", "outline: solid yellow 2px !important;");
	sheet.addRule(".currently-selling", "outline: solid purple 2px !important;");
	sheet.addRule(".sale-error", "outline: solid red 2px !important;");
	sheet.addRule(".sold", "outline: solid green 2px !important;");
	sheet.addRule(".rh-header-section", "display: inline-flex; align-items: center; margin: 0 8px;");
	sheet.addRule(".rh-header-section input[type=checkbox]", "position: relative; top:1px;");
	sheet.addRule("#sell-all-btns.disabled *, #select-all-btn-span.disabled *", "cursor: default; background-image: none !important; background-color: grey !important;");
	let use_shortcuts = false;
	const active_inventory_page = document.querySelector("#active_inventory_page");
	active_inventory_page.insertAdjacentHTML("beforebegin", `
		<div style="display: flex; padding: 0 16px">
			<span class="rh-header-section">
				<input type="checkbox" id="use_shortcuts" />&nbsp<label for="use_shortcuts">Keyboard Shortcuts?</label>
			</span>
			<span class="rh-header-section">
				<input type="checkbox" id="select_items" />&nbsp<label for="select_items">Select Items To Sell</label>
			</span>
			<span class="rh-header-section disabled" id="sell-all-btns">
				<a href="javascript:void(0)" class="btn_small btn_blue_white_innerfade" id="qs-all"><span>Quicksell All</span></a>
				&nbsp;
				<a href="javascript:void(0)" class="btn_small btn_blue_white_innerfade" id="list-all"><span>List All</span></a>	
			</span>
			<span class="rh-header-section disabled" id="select-all-btn-span">
				<a href="javascript:void(0)" class="btn_small btn_blue_white_innerfade" id="select-all"><span>Select/Deselect All</span></a>	
			</span>
		</div>
	`);
	document.querySelector("#use_shortcuts").addEventListener("change", e => use_shortcuts = e.target.checked);
	document.querySelector("#select_items").addEventListener("change", e => {
		selecting_items = e.target.checked;
		if(!selecting_items) {
			document.querySelector("#select-all-btn-span").addClassName("disabled");
			selected_items = {};
			num_selected_items = 0;
			document.querySelectorAll(".selected-for-sale").forEach(e => e.removeClassName("selected-for-sale"));
			document.querySelector("#sell-all-btns").addClassName("disabled");
		} else {
			document.querySelector("#select-all-btn-span").removeClassName("disabled");
		}
	});
	function getSellButton(title) {
		const btn = document.querySelector(`.inventory_iteminfo[style*="z-index: 1"] .steamdb_quick_sell a[title*="${title}"]`);
		if(!btn || !btn.dataset.price || SellItemDialog.m_bWaitingOnServer || (SellItemDialog.m_modal && SellItemDialog.m_modal.m_bVisible)) return false;
		return btn;
	}
    function openQuickSell() {
		let qs = getSellButton("highest listed buy order price");
        if(!qs && getSellButton("lowest listed sell price")) return openListLowest(); // If there is no buy order, then just use lowest list price
		return qs ? qs.click() || true : false;
    }
    function openListLowest() {
		let qs = getSellButton("lowest listed sell price");
		return qs ? qs.click() || true : false;
    }
    function confirmSale() {
        let ok_btn;
        if(!SellItemDialog.m_bWaitingForUserToConfirm || !(ok_btn = document.querySelector("#market_sell_dialog_ok"))) return false;
        ok_btn.click();
        return true;
	}
	function sellAndDismiss(sell_function) {
		if(!sell_function()) return;
		let int = setInterval(() => {
			if(!confirmSale()) return;

			clearInterval(int);
			setTimeout(() => SellItemDialog.Dismiss(), 50);
		}, 50);
	}
    document.addEventListener("keyup", function(event) {
        if(!use_shortcuts) return;
        if(event.key == "q") {
            openQuickSell();
        }
        if(event.key == "Q") {
			sellAndDismiss(openQuickSell);
        }
        if(event.key == "l") {
            openListLowest();
        }
        if(event.key == "L") {
			sellAndDismiss(openListLowest);
        }
        if(event.key == 'a') {
            confirmSale()
        }
	});

	let selecting_items = false;
	let selected_items = {};
	let num_selected_items = 0;

	function sellAllSelected(sell_function) {
		const selected_item_ids = Object.keys(selected_items);
		let total_value_recv = 0;
		let total_value_buy = 0;
		let items_sold = {};
		function sellNext() {
			if(SellItemDialog.m_bWaitingOnServer) return setTimeout(sellNext, 25);
			const current_sale = selected_item_ids.shift();
			if(!current_sale || !selected_items[current_sale]) {
				window.gPriceModal = ShowAlertDialog("Sale Complete!", `
					<div style="font-size: 1.125em; float: right; margin-left: 30px;">
						Cost To Buyers: <span style="float: right; margin-left: 8px;">$${(total_value_buy / 100).toFixed(2)}</span><br />
						Amount To Receive: <span style="float: right; margin-left: 8px;">$${(total_value_recv / 100).toFixed(2)}</span>
					</div>
					<div style="font-size:1.4em; float: left;">Items Sold</div>
					<div style="clear: left;"></div>
					<hr style="background: #acb2b8; border: none; height: 1px; margin-block-end: 1em; margin-inline-start: 0;">
					<ul style="margin: 0 0 -45px 0; padding-inline-end: 66px; padding-left: 30px;">
						${ Object.keys(items_sold).map(item_name => `<li>${item_name} ×${items_sold[item_name]}</li>`).join("") }
					</ul>
				`);

				const modalElement = window.gPriceModal.m_$Content[0];
				const content_border = window.gPriceModal.m_$StandardContent[0].parentElement;
				content_border.style.maxHeight = innerHeight - content_border.offsetTop - 200 + "px";

				modalElement.style.overflow = "hidden";
				modalElement.style.height = 0;
				modalElement.style.transition = "height 500ms";
				modalElement.style.height = content_border.getHeight() + content_border.offsetTop + "px";
				return setTimeout(() => {
					window.gPriceModal.AdjustSizing(500);
				}, 500);
			}
			OnLocationChange(null, "#" + current_sale);

			// If the page is already loaded, might as well add the currently selling class before the prices load.
			let item = document.getElementById(current_sale);
			if(item) {
				item.removeClassName("selected-for-sale");
				item.addClassName("currently-selling");
			}

			let sell_interval = setInterval(() => {
				if(!sell_function()) return;
				clearInterval(sell_interval);
				
				item = document.getElementById(current_sale);
				item.removeClassName("selected-for-sale");
				item.addClassName("currently-selling");

				const item_value_recv = SellItemDialog.GetPriceAsInt();
				const item_value_buy = SellItemDialog.GetBuyerPriceAsInt();
				const item_market_name = g_ActiveInventory.selectedItem.description.market_name;

				function checkConfirmed(attempt) {
					
					const error_el = document.querySelector("#market_sell_dialog_error");
					// clear custom error message if exists
					if(error_el) error_el.innerHTML = error_el.innerHTML.replace(/\<br\> Retrying in.*\/5\)/,"");
					if(!SellItemDialog.m_bWaitingOnServer && attempt >= 5) {
						(error_el || {}).innerHTML += "<br> Failed after five retries. Skipping..."

						delete selected_items[current_sale];
						return setTimeout(() => {
							SellItemDialog.Dismiss();
							item.removeClassName("currently-selling");
							item.addClassName("sale-error");
							sellNext();
						}, 1000);
					}
					// item should theoretically be listed
					if(!SellItemDialog.m_bWaitingOnServer && !SellItemDialog.m_bWaitingForUserToConfirm) {
						total_value_recv += item_value_recv;
						total_value_buy += item_value_buy;
						items_sold[item_market_name] = (items_sold[item_market_name] || 0) + 1;
						item.removeClassName("currently-selling");
						item.addClassName("sold");
						delete selected_items[current_sale];
						return sellNext();
					}
					if(!SellItemDialog.m_bWaitingOnServer) {
						if(SellItemDialog.m_bWaitingForUserToConfirm && attempt > 0) { // Errorrrr
							(error_el || {}).innerHTML += `<br> Retrying in one second. (Attempt ${attempt++}/5)`
							return setTimeout(() => {
								confirmSale();
								checkConfirmed(attempt);
							}, 1000);
						}
					}
					return setTimeout(() => checkConfirmed(!attempt ? 1 : attempt), 50);
				};
				confirmSale();
				checkConfirmed(0);
			}, 50);
		}
		sellNext();
	}

	document.querySelector("#qs-all").addEventListener("click", event => {
		if(document.querySelector("#sell-all-btns").hasClassName("disabled")) return;
		sellAllSelected(openQuickSell);
	})
	document.querySelector("#list-all").addEventListener("click", event => {
		if(document.querySelector("#sell-all-btns").hasClassName("disabled")) return;
		sellAllSelected(openListLowest);
	})
	document.querySelector("#select-all").addEventListener("click", event => {
		if(document.querySelector("#select-all-btn-span").hasClassName("disabled")) return;
		selectAllOnPage();
	})
	
	function selectAllOnPage() {
		if(!selecting_items) return;
		let count_already_selected = 0;
		document.querySelectorAll(`div.inventory_page:not([style="display: none;"]) .itemHolder .item.app${g_ActiveInventory.appid}`).forEach(e => {
			e.removeClassName("sale-error");
			if(selected_items[e.id] || e.hasClassName("sold") || !e.rgItem.description.marketable) return count_already_selected++;

			selected_items[e.id] = 1;
			e.addClassName("selected-for-sale");
			num_selected_items++;
			document.querySelector("#sell-all-btns").removeClassName("disabled");
		})
		if(count_already_selected >= 25) {
			document.querySelectorAll(`div.inventory_page:not([style="display: none;"]) .itemHolder .item.app${g_ActiveInventory.appid}`).forEach(e => {
				if(e.hasClassName("sold")) return;
				e.removeClassName("selected-for-sale");
				e.removeClassName("sale-error");
				delete selected_items[e.id];
				num_selected_items--;
				if(num_selected_items == 0) document.querySelector("#sell-all-btns").addClassName("disabled");
			});
		}
	}
	
	document.querySelector("#inventories").addEventListener("click", event => {
		if(!selecting_items) return;
		event.preventDefault();
		if(!event.target.hasClassName("inventory_item_link")) return;
		const item_element = event.target.parentElement;
		const id = item_element.id;
		if(!item_element.rgItem.description.marketable) return;
		if(item_element.hasClassName("sold")) return;
		item_element.removeClassName("sale-error");
		selected_items[id] = !selected_items[id];
		if(selected_items[id]) {
			item_element.addClassName("selected-for-sale");
			document.querySelector("#sell-all-btns").removeClassName("disabled");
			num_selected_items++;
		} else {
			item_element.removeClassName("selected-for-sale");
			delete selected_items[id];
			num_selected_items--;
			if(num_selected_items == 0) document.querySelector("#sell-all-btns").addClassName("disabled");
		}
	})
})();