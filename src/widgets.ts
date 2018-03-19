import * as $ from 'jquery';
import * as noUiSlider from 'nouislider';

function update_widget(widget: any, values: any) {
  if (widget.hasClass("ui-slider")) {
    widget.slider('option', {
      min: 0,
      max: values.length-1,
      dim_vals: values,
      value: 0,
      dim_labels: values
    })
    widget.slider('option', 'slide').call(widget, event, {value: 0})
  } else {
    widget.empty();
    for (var i=0; i<values.length; i++){
      widget.append($("<option>", {
        value: i,
        text: values[i]
      }))
    };
    widget.data('values', values);
    widget.data('value', 0);
    widget.trigger("change");
  };
}

export
function init_slider(id: string, plot_id: string, dim: string, values: any, next_vals: any,
                     labels: any[], dynamic: boolean, step: number, value: any, next_dim: string,
                     dim_idx: number, delay: number = 500) {
  var fileref=document.createElement("link")
  fileref.setAttribute("rel", "stylesheet")
  fileref.setAttribute("type", "text/css")
  fileref.setAttribute("href", "//cdn.bootcss.com/noUiSlider/8.5.1/nouislider.min.css")
  document.getElementsByTagName("head")[0].appendChild(fileref)
  var vals = values;
  if (dynamic && vals.constructor === Array) {
    var default_value = parseFloat(value);
    var min = parseFloat(vals[0]);
    var max = parseFloat(vals[vals.length-1]);
    var wstep = step;
    var dim_labels: any[] = [default_value];
    var init_label: any = default_value;
  } else {
    var min = 0;
    if (dynamic) {
      var max = Object.keys(vals).length - 1;
      var init_label: any = labels[value];
      var default_value: number = values[value];
    } else {
      var max = vals.length - 1;
      var init_label: any = labels[value];
      var default_value: number = value;
    }
    var wstep = 1;
    var dim_labels: any[] = labels;
  }
  function adjustFontSize(text: any) {
    var width_ratio = (text.parent().width()/8)/text.val().length;
    var size = Math.min(0.9, Math.max(0.6, width_ratio))+'em';
    text.css('font-size', size);
  }
  var slider = (document as any).getElementById('_anim_widget'+id+'_'+dim);
  noUiSlider.create(slider, {
    range: {
      'min': min,
      'max': max
    },
    start: [default_value],
    step: wstep
  });
  slider.noUiSlider.on('update', function() {
    var dim_val = slider.noUiSlider.get();
    if (dynamic) {
      if (vals.constructor === Array) {
        var dim_val: any = parseFloat(dim_val);
        var label: any = dim_val;
      } else {
        var dim_val: any = parseInt(dim_val);
        var label: any = dim_labels[parseInt(dim_val)];
      }
    } else {
      var dim_val = vals[parseInt(dim_val)];
      var label: any = dim_labels[parseInt(dim_val)];
    }
    var text = $('#textInput'+id+'_'+dim);
    text.val(label);
    adjustFontSize(text);
    if (!(plot_id in (window as any).HoloViews.index)) { return; }
    (window as any).HoloViews.index[plot_id].set_frame(dim_val, dim_idx);
    if (Object.keys(next_vals).length > 0) {
      var new_vals = next_vals[dim_val];
      var next_widget = $('#_anim_widget'+id+'_'+next_dim);
      update_widget(next_widget, new_vals);
    }
  });
  var textInput = $('#textInput'+id+'_'+dim)
  textInput.val(init_label);
  adjustFontSize(textInput);
}


export
function init_dropdown(id: string, plot_id: string, dim: string, vals: any,
                       value: number, next_vals: any, labels: any, next_dim: string,
                       dim_idx: number, dynamic: boolean) {
  var widget = $("#_anim_widget"+id+'_'+dim);
  widget.data('values', vals)
  for (var i=0; i<vals.length; i++){
    if (dynamic) {
      var val: any = vals[i];
    } else {
      var val: any = i;
    }
    widget.append($("<option>", {
      value: val,
      text: labels[i]
    }));
  };
  widget.data("next_vals", next_vals);
  widget.val(value);
  widget.on('change', function(event: any, ui: any) {
    if (dynamic) {
      var dim_val: any = parseInt(this.value);
    } else {
      var dim_val: any = $.data(this, 'values')[this.value];
    }
    var next_vals = $.data(this, "next_vals");
    if (Object.keys(next_vals).length > 0) {
      var new_vals = next_vals[dim_val];
      var next_widget = $('#_anim_widget'+id+'_'+next_dim);
      update_widget(next_widget, new_vals);
    }
    var widgets = (window as any).HoloViews.index[plot_id]
    if (widgets) {
      widgets.set_frame(dim_val, dim_idx);
    }
  });
}
