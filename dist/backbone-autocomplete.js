"use strict";

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

  // @param input [HTMLInputElement]
  // @param options [Object]
  // @param options.collection [Backbone.Collection]
  // @param options.selected [Backbone.Model]
  create: function create(input) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var view = new Backbone.Autocomplete.View(_({ el: this.createContainerElement(input),
      collection: this.extractCollection(options)
    }).extend(options));

    $(input).data("Backbone.Autocomplete.View", view);
    return view;
  },
  createContainerElement: function createContainerElement(input) {
    var el = $("<div>").addClass("backbone-autocomplete");
    $(input).before(el);
    $(el).append(input);

    return el;
  },
  extractCollection: function extractCollection(options) {
    var collection = options.collection;
    delete options.collection;

    if (!collection) {
      var url = options.url;
      delete options.url;

      if (!url) {
        throw "Backbone.Autocomplete.create requires collection or url";
      }

      collection = this.createCollectionFromURL(url);
    }

    return collection;
  },
  createCollectionFromURL: function createCollectionFromURL(_url) {
    var model_class = Backbone.Model.extend({
      idAttribute: "value"
    });

    var collection_class = Backbone.Collection.extend({
      model: model_class,
      url: function url() {
        return _url + "?q=" + window.encodeURIComponent(this.query);
      }
    });

    return new collection_class();
  }
};

// flux の dispatcher, action creator, store の役割
Backbone.Autocomplete.State = Backbone.Model.extend({
  defaults: {
    query: "",
    collection: null,
    dropdownFocused: false,
    focused: null,
    focusedBy: null,
    selected: null,
    showDropdown: false
  },

  constructor: function constructor() {
    var _this = this;

    Backbone.Model.prototype.constructor.apply(this, arguments);
    this.get("collection").on("sync", function () {
      return _this.onSyncCollection();
    });
    this.on("change:query", function () {
      return _this.onChangeQuery();
    });
    this.on("change:selected", function () {
      return _this.onChangeSelected();
    });
    if (Backbone.Autocomplete.DEBUG) {
      this.on("change", function () {
        console.log(_this.attributes);
      });
    }
  },
  onSyncCollection: function onSyncCollection() {
    if (this.get("collection").length === 0) {
      this.set({ selected: null, focused: null });
    }
    this.trigger("change");
  },
  onChangeQuery: function onChangeQuery() {
    this.get("collection").query = this.get("query");
    this.get("collection").fetch();
  },
  onChangeSelected: function onChangeSelected() {
    var selected = this.get("selected");
    if (selected) {
      this.set({ query: selected.get("label") });
    }
  },
  logAction: function logAction(type) {
    if (Backbone.Autocomplete.DEBUG) {
      var _console;

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      (_console = console).log.apply(_console, [type].concat(args));
    }
  },
  updateQuery: function updateQuery(query) {
    this.logAction("updateQuery", query);
    this.set({ query: query });
  },
  showDropdown: function showDropdown() {
    this.logAction("showDropdown");
    this.set({ showDropdown: true });
  },
  hideDropdown: function hideDropdown() {
    this.logAction("hideDropdown");
    this.set({
      showDropdown: false,
      dropdownFocused: false
    });
  },
  focusItem: function focusItem(item, _ref) {
    var _ref$by = _ref.by;
    var by = _ref$by === undefined ? null : _ref$by;

    this.logAction("focusItem", { by: by });
    this.set({
      focused: item,
      focusedBy: by
    });
  },
  focusUp: function focusUp() {
    this.logAction("focusUp");
    this.focusRelative(-1);
  },
  focusDown: function focusDown() {
    this.logAction("focusDown");
    this.focusRelative(1);
  },


  // private
  focusRelative: function focusRelative(offset) {
    var model_will_be_focused = void 0;
    var focused = this.get("focused");
    var focused_exists_in_collection = focused && this.get("collection").find(function (m) {
      return m.id === focused.id;
    });

    if (focused && focused_exists_in_collection) {
      this.get("collection").models.forEach(function (m, i, list) {
        if (m.id === focused.id) {
          model_will_be_focused = list[i + offset];
          return;
        }
      });
    } else {
      model_will_be_focused = this.get("collection").models[0];
    }

    if (model_will_be_focused) {
      this.focusItem(model_will_be_focused, { by: "key" });
    }
  },
  updateDropdownFocused: function updateDropdownFocused(value) {
    this.logAction("updateDropdownFocused", value);
    this.set({ dropdownFocused: value });
  },
  selectItemFocusedByKey: function selectItemFocusedByKey() {
    this.logAction("selectItemFocusedByKey");
    if (this.get("focused") && this.get("focusedBy") === "key") {
      this.set({ selected: this.get("focused") });
    }
  },
  selectItem: function selectItem(model) {
    this.logAction("selectItem");
    this.set({ selected: model });
  }
});

Backbone.Autocomplete.View = Backbone.View.extend({
  attributes: {
    class: "backbone-autocomplete"
  },

  events: {
    "focus input": "onFocus",
    "blur input": "onBlur",
    "keydown input": "onKeyDown",
    "keyup input": "onKeyUp"
  },

  initialize: function initialize(options) {
    var _this2 = this;

    this.input = this.$("input")[0];
    this.$input = $(this.input);

    this.state = new Backbone.Autocomplete.State({
      collection: options.collection,
      selected: options.selected || null
    });

    this.state.on("change:selected", function () {
      _this2.selected = _this2.state.get("selected");
      _this2.trigger("change", _this2);
    });

    this.state.on("change", function () {
      _this2.render();
    });

    this.createDropdownView();
  },
  render: function render() {
    if (this.state.get("query") && !this.state.get("selected")) {
      this.$el.addClass("is-invalid");
    } else {
      this.$el.removeClass("is-invalid");
    }
    this.$input.val(this.state.get("query"));
    this.renderDropdownView();
  },
  renderDropdownView: function renderDropdownView() {
    var $input = this.$input;
    this.dropdownView.render({
      css: {
        fontSize: $input.css("font-size"),
        top: $input.position().top + $input.outerHeight() - 1,
        minWidth: $input.innerWidth()
      }
    });
  },
  createDropdownView: function createDropdownView() {
    this.dropdownView = new Backbone.Autocomplete.DropdownView({ state: this.state });
    $(this.el).append(this.dropdownView.el);
  },
  onFocus: function onFocus(e) {
    this.state.showDropdown();
  },
  onBlur: function onBlur(e) {
    if (!this.state.get("dropdownFocused")) {
      this.state.selectItemFocusedByKey();
      this.state.hideDropdown();
      if (this.state.get("query") === "") {
        this.state.selectItem(null);
      }
    }
  },


  // キー長押しで繰り返し処理するため
  // 文字以外のキーは keydown で処理
  onKeyDown: function onKeyDown(e) {
    switch (e.originalEvent.code) {
      case "ArrowUp":
        e.preventDefault();
        this.state.focusUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.state.focusDown();
        break;
      case "Enter":
        this.state.selectItemFocusedByKey();
        this.state.hideDropdown();
        break;
    }
  },


  // 入力後の文字列を使いたいので、文字のキーは keyup で処理
  onKeyUp: function onKeyUp(e) {
    switch (e.originalEvent.code) {
      case "ArrowUp":
        break;
      case "ArrowDown":
        break;
      case "Enter":
        break;
      default:
        this.state.updateQuery(this.$input.val());
    }
  }
});

Backbone.Autocomplete.DropdownView = Backbone.View.extend({
  tagName: "ul",
  attributes: {
    class: "backbone-autocomplete-dropdown"
  },

  events: {
    "mousedown": "onMouseDown"
  },

  initialize: function initialize(options) {
    this.state = options.state;
    this.itemViews = [];
  },
  render: function render(options) {
    this.$el.css(options.css);

    this.renderOptions();

    if (this.state.get("showDropdown")) {
      this.$el.show();
    } else {
      this.$el.hide();
    }
  },
  renderOptions: function renderOptions() {
    this.updateItemViews();

    if (this.state.get("focused") && this.state.get("focusedBy") === "key") {
      this.scrollToItem(this.state.get("focused"));
    }
  },
  updateItemViews: function updateItemViews() {
    var new_item_views = [];
    var collection = this.state.get("collection");

    var i = 0;

    for (var _i = 0; _i < collection.length || _i < this.itemViews.length; _i++) {
      var model = collection.models[_i];
      var view = this.itemViews[_i];

      if (model && view && model.id === view.model.id) {
        view.render();
        new_item_views.push(view);
      } else {
        if (model) {
          var v = new Backbone.Autocomplete.DropdownItemView({ model: model, state: this.state });
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
  onMouseDown: function onMouseDown() {
    this.state.updateDropdownFocused(true);
  },
  scrollToItem: function scrollToItem(item) {
    if (!item) {
      return;
    }

    var item_view = _(this.itemViews).find(function (v) {
      return v.model.id == item.id;
    });
    if (!item_view) {
      return;
    }

    var item_view_top = $(item_view.el).position().top;
    var item_view_height = $(item_view.el).outerHeight();
    var scroll_top = this.$el.scrollTop();

    if (item_view_top < 0) {
      // 上にはみ出した場合
      this.$el.scrollTop(scroll_top + item_view_top);
    } else if (this.$el.outerHeight() < item_view_top + item_view_height) {
      // 下にはみ出した場合
      this.$el.scrollTop(scroll_top + item_view_height);
    }
  }
});

Backbone.Autocomplete.DropdownItemView = Backbone.View.extend({
  tagName: "li",
  events: {
    "mouseenter": "onMouseEnter",
    "click": "onClick"
  },

  initialize: function initialize(options) {
    this.state = options.state;
    this.model = options.model;
  },
  render: function render() {
    this.$el.text(this.model.get("label"));
    if (this.state.get("focused") && this.state.get("focused").id === this.model.id) {
      this.$el.addClass("is-selected");
    } else {
      this.$el.removeClass("is-selected");
    }
  },
  onMouseEnter: function onMouseEnter() {
    this.state.focusItem(this.model, { by: "mouse" });
  },
  onClick: function onClick() {
    this.state.selectItem(this.model);
    this.state.hideDropdown();
  }
});