/*
TODO
- hit 0 のときの表示
- model.get("label") が決め打ちなのを修正
- jquery ui 互換のインターフェイス
- stickkit 対応 (hidden 使う?)
- 文字入力されていて selected が null なら is-invalid クラス付与
*/

// #query を元に fetch できる collection を指定する
Backbone.Autocomplete = {
  DEBUG: false,

  // @param queryField [HTMLInputElement]
  // @param options [Object]
  // @param options.collection [Backbone.Collection]
  // @param options.selected [Backbone.Model]
  create(queryField, options = {}) {
    options.collection = this.extractCollection(options);

    if (options.selected && options.selected.constructor !== options.collection.model) {
      options.selected = new options.collection.model(options.selected);
    }

    // label に囲まれている場合、dropdownItem のクリック時に queryField の focus イベントが発火してしまう問題を回避
    $(queryField).closest("label").on("click", function(e) {
      e.preventDefault();
    })

    const view = new Backbone.Autocomplete.View(
      _({ el: this.createContainerElement(queryField),
          queryField: queryField,
      }).extend(options)
    );

    $(queryField).data("Backbone.Autocomplete.View", view);
    return view;
  },

  createContainerElement(queryField) {
    const el = $("<div>").addClass("backbone-autocomplete");
    $(queryField).before(el);
    $(el).append(queryField);

    return el;
  },

  extractCollection(options) {
    let collection = options.collection;
    delete options.collection;

    if (!collection) {
      const url = options.url;
      delete options.url;

      if (!url) {
        throw "Backbone.Autocomplete.create requires collection or url";
      }

      collection = this.createCollectionFromURL(url);
    }

    return collection;
  },

  createCollectionFromURL(url) {
    const model_class = Backbone.Model.extend({
      idAttribute: "value",
    });

    let url_function;
    if (typeof(url) === "function") {
      url_function = url;
    } else {
      url_function = function() {
        if (url.match(/\?/)) {
          return url + "&term=" + window.encodeURIComponent(this.query);
        } else {
          return url + "?term=" + window.encodeURIComponent(this.query);
        }
      }
    }

    const collection_class = Backbone.Collection.extend({
      model: model_class,
      url: url_function,
    });

    return new collection_class;
  },
};

// flux の dispatcher, action creator, store の役割
Backbone.Autocomplete.State = Backbone.Model.extend({
  defaults: {
    editingQuery: false,
    query: "",
    collection: null,
    dropdownFocused: false,
    focused: null,
    focusedBy: null,
    selected: null,
    showDropdown: false,
    openOnFocus: false,
  },

  constructor() {
    Backbone.Model.prototype.constructor.apply(this, arguments);
    this.get("collection").on("sync", () => this.onSyncCollection());
    this.on("change:query", () => this.onChangeQuery());
    this.on("change:selected", () => this.onChangeSelected());
    if (Backbone.Autocomplete.DEBUG) {
      this.on("change", () => {
        console.log(this.attributes);
      });
    }
  },

  onSyncCollection() {
    if (this.get("collection").length === 0) {
      this.set({selected: null, focused: null});
    }

    this.trigger("change");
  },

  onChangeQuery() {
    if (this.get("query") === "") {
      this.selectItem(null);
      this.focusItem(null, {by: null});
    }
    this.updateCollection();
  },

  onChangeSelected() {
    const selected = this.get("selected");
    if (selected) {
      this.set({query: selected.get("name") || selected.get("label")});
    }
  },

  logAction(type, ...args) {
    if (Backbone.Autocomplete.DEBUG) {
      console.log(type, ...args);
    }
  },

  updateCollection() {
    this.get("collection").query = this.get("query");
    this.get("collection").fetch();
  },

  editQuery(value = true) {
    this.logAction("editQuery", value);
    this.set({editingQuery: value});
  },

  updateQuery(query) {
    this.logAction("updateQuery", query);
    this.set({query: query});
  },

  showDropdown() {
    this.logAction("showDropdown");
    this.set({showDropdown: true});
  },

  hideDropdown() {
    this.logAction("hideDropdown");
    this.set({
      showDropdown: false,
      dropdownFocused: false,
    });
  },

  focusItem(item, {by = null}) {
    this.logAction("focusItem", item, {by: by});
    this.set({
      focused: item,
      focusedBy: by,
    })
  },

  focusUp() {
    this.logAction("focusUp");
    this.focusRelative(-1);
  },

  focusDown() {
    this.logAction("focusDown");
    this.focusRelative(1);
  },

  // private
  focusRelative(offset) {
    let model_will_be_focused;
    const focused = this.get("focused");
    const focused_exists_in_collection = focused && this.get("collection").find((m) => m.id === focused.id);

    if (focused && focused_exists_in_collection) {
      this.get("collection").models.forEach((m, i, list) => {
        if (m.id === focused.id) {
          model_will_be_focused = list[i + offset];
          return;
        }
      });
    } else {
      model_will_be_focused = this.get("collection").models[0];
    }

    if (model_will_be_focused) {
      this.focusItem(model_will_be_focused, {by: "key"});
    }
  },

  updateDropdownFocused(value) {
    this.logAction("updateDropdownFocused", value);
    this.set({dropdownFocused: value});
  },

  selectItemFocusedByKey() {
    this.logAction("selectItemFocusedByKey");
    if (this.get("focused") && this.get("focusedBy") === "key") {
      this.set({selected: this.get("focused")});
    }
  },

  selectItem(model) {
    this.logAction("selectItem", model);
    this.set({selected: model});
  },

  unselectItem() {
    this.logAction("unselectItem");
    this.set({selected: null});
  },

  updateOpenOnFocus(value) {
    this.logAction("updateOpenOnFocus", value);
    this.set("openOnFocus", value);
  },
});

Backbone.Autocomplete.View = Backbone.View.extend({
  attributes: {
    class: "backbone-autocomplete",
  },

  events: {
    "focus [data-backbone-autocomplete-view-query-field]": "onFocus",
    "blur [data-backbone-autocomplete-view-query-field]": "onBlur",
    "keydown [data-backbone-autocomplete-view-query-field]": "onKeyDown",
    "keyup [data-backbone-autocomplete-view-query-field]": "onKeyUp",
  },

  initialize(options) {
    this.queryField = options.queryField;
    this.$queryField = $(this.queryField).attr({"data-backbone-autocomplete-view-query-field": "true", autocomplete: "off"})

    this.state = new Backbone.Autocomplete.State({
      collection: options.collection,
      selected: options.selected || null,
      query: options.selected && options.selected.get("label") || "",
      openOnFocus: options.openOnFocus,
    });

    this.state.on("change:selected", () => {
      this.selected = this.state.get("selected");
      this.trigger("change", this);
    });

    this.state.on("change", () => {
      this.render();
    });

    this.createDropdownView();
  },

  render() {
    if (this.state.get("query") && !this.state.get("selected")) {
      this.$queryField.addClass("is-invalid");
    } else {
      this.$queryField.removeClass("is-invalid");
    }

    if (!this.state.get("editingQuery")) {
      this.$queryField.val(this.state.get("query"));
    }
    this.renderDropdownView();
  },

  renderDropdownView() {
    const $queryField = this.$queryField;
    this.dropdownView.render({
      css: {
        fontSize: $queryField.css("font-size"),
        top: $queryField.position().top + parseInt($queryField.css("margin-top"), 10) + $queryField.outerHeight() - 1,
        left: $queryField.position().left + parseInt($queryField.css("margin-left"), 10),
        minWidth: $queryField.innerWidth(),
      },
    });
  },

  createDropdownView() {
    this.dropdownView = new Backbone.Autocomplete.DropdownView({state: this.state});
    $(this.el).append(this.dropdownView.el);
  },

  onFocus(e) {
    if (this.state.get("openOnFocus")) {
      this.state.updateCollection();
      this.state.showDropdown();
    }
  },

  onBlur(e) {
    if (!this.state.get("dropdownFocused")) {
      this.state.editQuery(false);
      this.state.selectItemFocusedByKey();
      this.state.hideDropdown();
    }
  },

  // キー長押しで繰り返し処理するため
  // 文字以外のキーは keydown で処理
  onKeyDown(e) {
    switch(this.getKey(e.originalEvent)) {
      case "ArrowUp":
        e.preventDefault();
        this.state.focusUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.state.focusDown();
        break;
      case "Enter":
        if (this.state.get("focused")) {
          e.preventDefault(); // submit しない
          this.state.editQuery(false);
          this.state.selectItemFocusedByKey();
          this.state.hideDropdown();
        }
        break;
      default:
        this.state.editQuery(true);
        this.state.showDropdown();
    }
  },

  // 入力後の文字列を使いたいので、文字のキーは keyup で処理
  onKeyUp(e) {
    switch(this.getKey(e.originalEvent)) {
      case "ArrowUp":
        break;
      case "ArrowDown":
        break;
      case "Enter":
        break;
      default:
        const v = this.$queryField.val();
        if (v !== this.state.get("query")) {
          this.state.unselectItem();
          this.state.updateQuery(v);
        }
    }
  },

  getKey(e) {
    // Firefox, Chrome
    if (e.code) {
      return e.code;
    }

    // IE11, Edge
    if (e.key) {
      switch(e.key.toString()) {
        case "Up":
        case "Down":
        case "Left":
        case "Right":
          return "Arrow" + e.key;
        default:
          return e.key;
      }
    }

    // Safari
    let v;
    switch(e.keyCode) {
      case 37:
        return "ArrowLeft";
      case 38:
        return "ArrowUp";
      case 39:
        return "ArrowRight";
      case 40:
        return "ArrowDown";
      case 13:
        return "Enter";
    }
  }
});

Backbone.Autocomplete.DropdownView = Backbone.View.extend({
  tagName: "ul",
  attributes: {
    class: "backbone-autocomplete-dropdown",
  },

  events: {
    "mousedown": "onMouseDown",
  },

  initialize(options) {
    this.state = options.state;
    this.itemViews = [];
  },

  render(options) {
    this.$el.css(options.css);

    this.renderOptions();

    if (this.state.get("showDropdown")) {
      this.$el.show();
    } else {
      this.$el.hide();
    }
  },

  renderOptions() {
    this.updateItemViews();

    if (this.state.get("focused") && this.state.get("focusedBy") === "key") {
      this.scrollToItem(this.state.get("focused"));
    }
  },

  updateItemViews() {
    const new_item_views = [];
    const collection = this.state.get("collection");

    let i = 0;

    for (let i = 0; i < collection.length || i < this.itemViews.length; i++) {
      let model = collection.models[i];
      let view = this.itemViews[i];

      if (model && view && model.id === view.model.id) {
        view.render();
        new_item_views.push(view);
      } else {
        if (model) {
          const v = new Backbone.Autocomplete.DropdownItemView({model: model, state: this.state})
          v.render();
          this.$el.append(v.el);
          new_item_views.push(v);
        }

        if (view) {
          view.remove();
        }
      }
    }

    this.itemViews = new_item_views;
  },

  onMouseDown() {
    this.state.updateDropdownFocused(true);
  },

  scrollToItem(item) {
    if (!item) { return; }

    const item_view = _(this.itemViews).find((v) => v.model.id == item.id);
    if (!item_view) { return; }

    const item_view_top = $(item_view.el).position().top;
    const item_view_height = $(item_view.el).outerHeight();
    const scroll_top = this.$el.scrollTop();

    if (item_view_top < 0) {
      // 上にはみ出した場合
      this.$el.scrollTop(scroll_top + item_view_top);
    } else if (this.$el.outerHeight() < (item_view_top + item_view_height)) {
      // 下にはみ出した場合
      this.$el.scrollTop(scroll_top + item_view_height);
    }
  }
});

Backbone.Autocomplete.DropdownItemView = Backbone.View.extend({
  tagName: "li",
  events: {
    "mouseenter": "onMouseEnter",
    "click": "onClick",
  },

  initialize(options) {
    this.state = options.state;
    this.model = options.model;
  },

  render() {
    this.$el.text(this.model.get("label"));
    if (this.state.get("focused") && this.state.get("focused").id === this.model.id) {
      this.$el.addClass("is-selected");
    } else {
      this.$el.removeClass("is-selected");
    }
  },

  onMouseEnter() {
    this.state.focusItem(this.model, {by: "mouse"});
  },

  onClick() {
    this.state.editQuery(false);
    this.state.selectItem(this.model);
    this.state.hideDropdown();
  },
});
