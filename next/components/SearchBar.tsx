import { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import InputBase from "@material-ui/core/InputBase";
import MenuIcon from "@material-ui/icons/Menu";
import SearchIcon from "@material-ui/icons/Search";
import MenuItem from "@material-ui/core/MenuItem";
import Downshift from "downshift";
import getConfig from "next/config";
import reactLeaflet from "react-leaflet";

import { Geo } from "../types";

const { publicRuntimeConfig } = getConfig();
const { API_URL } = publicRuntimeConfig;

const useStyles = makeStyles({
  root: {
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    marginBottom: 8
  },
  input: {
    marginLeft: 8,
    flex: 1
  },
  iconButton: {
    padding: 10
  },
  paper: {
    position: "absolute",
    zIndex: 1,
  }
});

interface Props {
  onSearch: (viewport: reactLeaflet.Viewport) => void;
  onMenuButtonClick: () => void;
}

interface Suggestion {
  text: string;
  geo: Geo;
  type: string; // TODO enum
}

function SearchBar(props: Props) {
  const [text, setText] = useState("");
  const [selectedItem, setSelectedItem] = useState(null as Suggestion | null);
  const [suggestions, setSuggestions] = useState([] as Suggestion[]);
  const classes = useStyles();

  // TODO debouncing
  async function fetchSuggestions() {
    if (text) {
      const res = await fetch(`${API_URL}/geoInfo?q=${text}`);
      if (res.status === 200) {
        const data = await res.json();
        if (data.length > 0) {
          setSuggestions(data);
        }
      }
    } else {
      setSuggestions([]);
    }
  }

  useEffect(() => {
    fetchSuggestions();
  }, [text]);

  function handleChange(selectedItem: Suggestion) {
    setSelectedItem(selectedItem);
    props.onSearch({
      center: [selectedItem.geo.lat, selectedItem.geo.lng],
      zoom: 9
    });
  }

  async function hanldeSearch() {
    setSuggestions([]);
    if (text) {
      const res = await fetch(`${API_URL}/geoInfo?q=${text}`);
      if (res.status === 200) {
        const data = await res.json();
        if (data.length > 0) {
          const firstSuggestion = data[0];
          props.onSearch({
            center: [firstSuggestion.geo.lat, firstSuggestion.geo.lng],
            zoom: 9
          });
        }
      }
    }
  }

  return (
    <Downshift
      onChange={handleChange}
      itemToString={item => (item ? item.text : text)}
      inputValue={text}
      onInputValueChange={value => {
        setSelectedItem(null);
        setText(value);
      }}
      selectedItem={selectedItem}
    >
      {({ getInputProps, getItemProps, isOpen }) => (
        <div>
          <Paper className={classes.root}>
            <IconButton
              className={classes.iconButton}
              aria-label="menu"
              onClick={props.onMenuButtonClick}
            >
              <MenuIcon />
            </IconButton>
            <InputBase
              className={classes.input}
              placeholder="県名で検索"
              inputProps={{ "aria-label": "" }}
              onKeyPress={event => {
                if (event.key === "Enter") {
                  hanldeSearch();
                }
              }}
              onFocus={() => fetchSuggestions()}
              {...getInputProps()}
            />
            <IconButton
              onClick={hanldeSearch}
              className={classes.iconButton}
              aria-label="search"
            >
              <SearchIcon />
            </IconButton>
          </Paper>
          {isOpen && (
            <Paper className={classes.paper} square>
              {suggestions.map((item, index) => (
                <MenuItem
                  {...getItemProps({
                    key: item.text,
                    index,
                    item
                  })}
                >
                  {item.text}
                </MenuItem>
              ))}
            </Paper>
          )}
        </div>
      )}
    </Downshift>
  );
}

export default SearchBar;
